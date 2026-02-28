// Content script that runs on localhost:3000 to facilitate auth communication
// Checks localStorage for auth token and sends it to extension

(function () {
  // Only run once
  if (window.priceGitAuthChecked) return;
  window.priceGitAuthChecked = true;

  // Check for auth data in localStorage
  function checkAndSendAuth() {
    // Skip if extension context has been invalidated (e.g., after extension reload)
    if (!chrome.runtime?.id) return;

    try {
      const authData = localStorage.getItem("priceGitExtensionAuth");

      if (authData) {
        const { authToken, refreshToken, username } = JSON.parse(authData);

        // Store directly in extension storage
        try {
          chrome.storage.local.set({
            authToken,
            refreshToken,
            username,
          });
        } catch {
          // Storage error — non-critical
        }

        // Send to extension background script
        try {
          chrome.runtime.sendMessage(
            {
              action: "setAuth",
              authToken: authToken,
              refreshToken: refreshToken,
              username: username,
            },
            () => {
              // Ignore response — don't remove from localStorage as popup needs it
              if (chrome.runtime.lastError) {
                // Extension not ready — will retry
              }
            },
          );
        } catch {
          // Extension messaging not available — will retry
        }
      }
    } catch {
      // Auth check failed — will retry on next interval
    }
  }

  // Poll for auth data every 5 seconds to sync login from web app
  // This only syncs login TO extension, not logout
  setInterval(() => {
    checkAndSendAuth();
  }, 5000);

  // Check immediately on page load
  checkAndSendAuth();
})();
