// Background service worker for API requests

// Handle messages from external web pages (like the web app)
chrome.runtime.onMessageExternal.addListener(
  (request, sender, sendResponse) => {
    if (request.action === "ping") {
      sendResponse({ success: true, pong: true });
      return true;
    }

    if (request.action === "openTabWithScreenshot") {
      (async () => {
        try {
          await chrome.tabs.create({ url: request.url, active: true });
          sendResponse({ success: true });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();

      return true;
    }

    if (request.action === "openTabWithInstructionPopup") {
      (async () => {
        try {
          const tab = await chrome.tabs.create({
            url: request.url,
            active: true,
          });

          // Mark this tab as a recapture tab so popup can auto-start
          await chrome.storage.session.set({ [`recapture_${tab.id}`]: true });

          // Send success response immediately - don't wait for page load
          sendResponse({ success: true });

          // Wait for the page to finish loading before sending message
          const waitForTabLoad = (tabId) => {
            return new Promise((resolve) => {
              const listener = (updatedTabId, changeInfo) => {
                if (
                  updatedTabId === tabId &&
                  changeInfo.status === "complete"
                ) {
                  chrome.tabs.onUpdated.removeListener(listener);
                  resolve();
                }
              };
              chrome.tabs.onUpdated.addListener(listener);

              // Timeout after 10 seconds
              setTimeout(() => {
                chrome.tabs.onUpdated.removeListener(listener);
                resolve();
              }, 10000);
            });
          };

          await waitForTabLoad(tab.id);

          // Give content script a moment to initialize after load
          setTimeout(() => {
            chrome.tabs.sendMessage(
              tab.id,
              { action: "showInstructionPopup" },
              (response) => {
                if (chrome.runtime.lastError) {
                  // Retry after another short delay
                  setTimeout(() => {
                    chrome.tabs.sendMessage(tab.id, {
                      action: "showInstructionPopup",
                    });
                  }, 500);
                }
              },
            );
          }, 500);
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();

      return true;
    }

    return false;
  },
);

// Handle internal messages (from popup, content scripts, etc.)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "captureScreenshot") {
    // Capture the visible tab as a screenshot
    chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({
          success: false,
          error: chrome.runtime.lastError.message,
        });
      } else {
        sendResponse({
          success: true,
          dataUrl: dataUrl,
        });
      }
    });
    return true; // Keep channel open for async
  }

  const SUPABASE_URL = "https://qwclzmzadecdovdewple.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3Y2x6bXphZGVjZG92ZGV3cGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMjQ3OTYsImV4cCI6MjA3ODgwMDc5Nn0.IHq3PAijNaIXqAUuSg4TuSgOGzjud8vi5jz-siWuoqc";

  async function refreshAccessToken() {
    const { refreshToken } = await chrome.storage.local.get(["refreshToken"]);
    if (!refreshToken) return null;

    const response = await fetch(
      `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      },
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (data?.access_token && data?.refresh_token) {
      await chrome.storage.local.set({
        authToken: data.access_token,
        refreshToken: data.refresh_token,
      });
      return data.access_token;
    }

    return null;
  }

  if (request.action === "fetchAPI") {
    // Make the fetch request from the extension context (not page context)
    (async () => {
      try {
        const initialResponse = await fetch(request.url, request.options || {});

        if (initialResponse.status === 401) {
          const newToken = await refreshAccessToken();
          if (newToken && request.options?.headers?.Authorization) {
            const retryOptions = {
              ...(request.options || {}),
              headers: {
                ...(request.options?.headers || {}),
                Authorization: `Bearer ${newToken}`,
              },
            };

            const retryResponse = await fetch(request.url, retryOptions);
            if (!retryResponse.ok) {
              const data = await retryResponse.json().catch(() => ({
                message: retryResponse.statusText,
              }));
              sendResponse({
                success: false,
                status: retryResponse.status,
                data,
              });
              return;
            }

            const data = await retryResponse.json();
            sendResponse({
              success: true,
              status: retryResponse.status,
              data,
            });
            return;
          }
        }

        if (!initialResponse.ok) {
          const data = await initialResponse.json().catch(() => ({
            message: initialResponse.statusText,
          }));
          sendResponse({
            success: false,
            status: initialResponse.status,
            data,
          });
          return;
        }

        const data = await initialResponse.json();
        sendResponse({
          success: true,
          status: initialResponse.status,
          data,
        });
      } catch (error) {
        sendResponse({
          success: false,
          error: error.message,
        });
      }
    })();

    return true; // Keep the message channel open for async response
  }

  if (request.action === "setAuth") {
    // Store auth token and username from web app
    chrome.storage.local.set(
      {
        authToken: request.authToken,
        refreshToken: request.refreshToken,
        username: request.username,
      },
      () => {
        sendResponse({ success: true });
      },
    );
    return true;
  }

  if (request.action === "validateToken") {
    // Validate current token and refresh if needed
    (async () => {
      const { authToken } = await chrome.storage.local.get(["authToken"]);

      if (!authToken) {
        sendResponse({ valid: false, error: "No token found" });
        return;
      }

      // Try to validate token by checking with Supabase
      try {
        const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${authToken}`,
          },
        });

        if (response.ok) {
          sendResponse({ valid: true });
        } else if (response.status === 401) {
          // Token expired, try to refresh
          const newToken = await refreshAccessToken();

          if (newToken) {
            sendResponse({ valid: true, refreshed: true });
          } else {
            // Clear invalid auth
            await chrome.storage.local.remove([
              "authToken",
              "refreshToken",
              "username",
            ]);
            sendResponse({
              valid: false,
              error: "Token expired and refresh failed",
            });
          }
        } else {
          sendResponse({
            valid: false,
            error: `Validation failed: ${response.status}`,
          });
        }
      } catch (error) {
        sendResponse({ valid: false, error: error.message });
      }
    })();
    return true;
  }

  if (request.action === "refreshAuthFromWebApp") {
    (async () => {
      try {
        const tabs = await chrome.tabs.query({
          url: "http://localhost:3000/*",
        });
        if (!tabs.length) {
          sendResponse({ success: false, error: "No web app tab found" });
          return;
        }

        const [result] = await chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: () => {
            const authData = localStorage.getItem("priceGitExtensionAuth");
            if (authData) {
              const { authToken, username } = JSON.parse(authData);
              return { authToken, username };
            }
            return null;
          },
        });

        if (result?.result?.authToken && result?.result?.username) {
          await chrome.storage.local.set({
            authToken: result.result.authToken,
            username: result.result.username,
          });
          sendResponse({ success: true, data: result.result });
          return;
        }

        sendResponse({ success: false, error: "No auth found in web app" });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();

    return true;
  }
});

// Automatically refresh token every 50 minutes (tokens expire after 1 hour)
setInterval(
  async () => {
    const { authToken, refreshToken } = await chrome.storage.local.get([
      "authToken",
      "refreshToken",
    ]);

    if (authToken && refreshToken) {
      const SUPABASE_URL = "https://qwclzmzadecdovdewple.supabase.co";
      const SUPABASE_ANON_KEY =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3Y2x6bXphZGVjZG92ZGV3cGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMjQ3OTYsImV4cCI6MjA3ODgwMDc5Nn0.IHq3PAijNaIXqAUuSg4TuSgOGzjud8vi5jz-siWuoqc";

      try {
        const response = await fetch(
          `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
          {
            method: "POST",
            headers: {
              apikey: SUPABASE_ANON_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ refresh_token: refreshToken }),
          },
        );

        if (response.ok) {
          const data = await response.json();
          if (data?.access_token && data?.refresh_token) {
            await chrome.storage.local.set({
              authToken: data.access_token,
              refreshToken: data.refresh_token,
            });
          }
        }
      } catch {
        // Token refresh failed silently — will retry on next interval
      }
    }
  },
  50 * 60 * 1000,
); // 50 minutes
