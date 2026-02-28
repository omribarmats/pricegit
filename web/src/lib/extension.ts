/* eslint-disable @typescript-eslint/no-explicit-any */
declare const chrome: any;

/**
 * Extension detection and communication utilities
 */

const EXTENSION_ID = process.env.NEXT_PUBLIC_EXTENSION_ID || "";

/**
 * Check if the Chrome extension is installed
 */
export async function checkExtensionInstalled(): Promise<boolean> {
  // Check if we're in a browser environment with Chrome runtime API
  if (typeof window === "undefined" || !window.chrome?.runtime) {
    return false;
  }

  if (!EXTENSION_ID) {
    console.warn("Extension ID not configured");
    return false;
  }

  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(
        EXTENSION_ID,
        { action: "ping" },
        (response: any) => {
          // If we get any response, the extension is installed
          if (chrome.runtime.lastError) {
            resolve(false);
          } else {
            resolve(true);
          }
        },
      );

      // Timeout after 1 second
      setTimeout(() => resolve(false), 1000);
    } catch (error) {
      resolve(false);
    }
  });
}

/**
 * Request the extension to open a tab and start screenshot capture
 */
export async function openTabWithScreenshot(
  sourceUrl: string,
): Promise<boolean> {
  if (!window.chrome?.runtime || !EXTENSION_ID) {
    return false;
  }

  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(
        EXTENSION_ID,
        {
          action: "openTabWithScreenshot",
          url: sourceUrl,
        },
        (response: any) => {
          if (chrome.runtime.lastError) {
            console.error(
              "Extension communication error:",
              chrome.runtime.lastError,
            );
            resolve(false);
          } else {
            resolve(response?.success || false);
          }
        },
      );

      // Timeout after 2 seconds
      setTimeout(() => resolve(false), 2000);
    } catch (error) {
      console.error("Failed to communicate with extension:", error);
      resolve(false);
    }
  });
}

/**
 * Request the extension to open a tab and show instruction popup
 */
export async function openTabWithInstructionPopup(
  sourceUrl: string,
): Promise<boolean> {
  if (!window.chrome?.runtime || !EXTENSION_ID) {
    console.warn("Chrome runtime not available or extension ID missing");
    return false;
  }

  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(
        EXTENSION_ID,
        {
          action: "openTabWithInstructionPopup",
          url: sourceUrl,
        },
        (response: any) => {
          if (chrome.runtime.lastError) {
            console.error(
              "Extension communication error:",
              chrome.runtime.lastError,
            );
            resolve(false);
          } else {
            resolve(response?.success || false);
          }
        },
      );

      // Timeout after 2 seconds
      setTimeout(() => resolve(false), 2000);
    } catch (error) {
      console.error("Failed to communicate with extension:", error);
      resolve(false);
    }
  });
}
