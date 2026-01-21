// Background service worker for API requests

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

  if (request.action === "fetchAPI") {
    // Make the fetch request from the extension context (not page context)
    fetch(request.url, request.options || {})
      .then((response) => {
        if (!response.ok) {
          return response
            .json()
            .then((data) => {
              sendResponse({
                success: false,
                status: response.status,
                data: data,
              });
            })
            .catch(() => {
              sendResponse({
                success: false,
                status: response.status,
                data: { message: response.statusText },
              });
            });
        } else {
          return response.json().then((data) => {
            sendResponse({
              success: true,
              status: response.status,
              data: data,
            });
          });
        }
      })
      .catch((error) => {
        sendResponse({
          success: false,
          error: error.message,
        });
      });

    return true; // Keep the message channel open for async response
  }
});
