// Content script for LLM-powered price capture
// Flow: Screenshot → LLM Analysis → Form

// Auth sync from web app localStorage (works on any domain)
try {
  if (!window.priceGitAuthSynced) {
    window.priceGitAuthSynced = true;
    const syncAuthFromLocalStorage = () => {
      const authData = localStorage.getItem("priceGitExtensionAuth");
      if (!authData) return;
      const { authToken, refreshToken, username } = JSON.parse(authData);
      if (authToken && username) {
        try {
          chrome.storage.local.set({ authToken, refreshToken, username });
        } catch {
          // Storage error — non-critical
        }
        chrome.runtime.sendMessage({
          action: "setAuth",
          authToken,
          refreshToken,
          username,
        });
      }
    };

    // Try immediately and retry for a short window to catch late writes
    syncAuthFromLocalStorage();
    let attempts = 0;
    const interval = setInterval(() => {
      syncAuthFromLocalStorage();
      attempts += 1;
      if (attempts >= 5) clearInterval(interval);
    }, 1000);
  }
} catch {
  // Auth sync error — non-critical
}

// Listen for auth data posted from the web app
window.addEventListener("message", (event) => {
  if (!event?.data || event.data.type !== "PRICEGIT_AUTH") return;
  const { authToken, refreshToken, username } = event.data;
  if (authToken && username) {
    try {
      chrome.storage.local.set({ authToken, refreshToken, username });
    } catch {
      // Storage error — non-critical
    }
    chrome.runtime.sendMessage({
      action: "setAuth",
      authToken,
      refreshToken,
      username,
    });
  }
});

// State
let screenshotDataUrl = null;
let formData = {};
let userLocation = null;
let locationPromise = null;
let selectedProductUrl = null;

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (
    request.action === "startPriceCapture" ||
    request.action === "startLLMCapture"
  ) {
    startLLMCapture();
    sendResponse({ success: true });
  }

  if (request.action === "showInstructionPopup") {
    showInstructionPopup();
    sendResponse({ success: true });
  }

  return true;
});

function showInstructionPopup() {
  // Remove any existing popup
  const existingPopup = document.getElementById("extension-instruction-popup");
  if (existingPopup) {
    existingPopup.remove();
  }

  const popup = document.createElement("div");
  popup.id = "extension-instruction-popup";
  popup.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 20px 24px;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(102, 126, 234, 0.4);
    z-index: 2147483647;
    max-width: 350px;
    font-family: system-ui, -apple-system, sans-serif;
    animation: slideInRight 0.4s ease-out;
  `;

  popup.innerHTML = `
    <style>
      @keyframes slideInRight {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    </style>
    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
      <div style="font-size: 18px; font-weight: 600;">Next Step</div>
      <button id="close-popup-btn" style="background: none; border: none; color: white; font-size: 24px; cursor: pointer; padding: 0; line-height: 1; margin-left: 12px;">&times;</button>
    </div>
    <div style="font-size: 14px; line-height: 1.6; margin-bottom: 8px;">
      Click the <strong>PriceGit extension icon</strong> in your browser toolbar (top-right) to capture the price
    </div>
  `;

  document.body.appendChild(popup);

  const closeBtn = document.getElementById("close-popup-btn");
  if (closeBtn) {
    closeBtn.onclick = () => {
      popup.remove();
    };
  }
}

// ==========================================
// MAIN CAPTURE FLOW
// ==========================================

async function startLLMCapture() {
  try {
    // Remove instruction popup if it exists
    const instructionPopup = document.getElementById(
      "extension-instruction-popup",
    );
    if (instructionPopup) {
      instructionPopup.remove();
    }

    // Start location fetch in background (non-blocking)
    locationPromise = getUserLocation()
      .then((loc) => {
        userLocation = loc;
        return loc;
      })
      .catch(() => null);

    // Capture screenshot silently
    const response = await chrome.runtime.sendMessage({
      action: "captureScreenshot",
    });

    if (!response.success) {
      throw new Error(response.error || "Failed to capture screenshot");
    }

    screenshotDataUrl = response.dataUrl;

    // Show analyzing overlay while calling LLM
    showAnalyzingOverlay("Analyzing price...");

    const analysisResult = await analyzeScreenshotAPI();

    // Wait for location before proceeding
    if (locationPromise) {
      await locationPromise;
    }

    hideAnalyzingOverlay();

    if (!userLocation) {
      showLocationRequiredModal();
      return;
    }

    handleAnalysisResult(analysisResult);
  } catch (error) {
    hideAnalyzingOverlay();
    if (error.message === "LOGIN_REQUIRED") {
      showSessionExpiredModal();
    } else {
      showWarningModal(
        "Capture Failed",
        "Failed to capture price: " + error.message,
        "OK",
      );
    }
  }
}

// ==========================================
// GEOLOCATION
// ==========================================

async function getUserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const location = await reverseGeocode(latitude, longitude);
          resolve(location);
        } catch (error) {
          resolve({
            latitude,
            longitude,
            city: "Unknown",
            country: "Unknown",
            fullAddress: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
          });
        }
      },
      (error) => {
        reject(error);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
}

async function reverseGeocode(latitude, longitude) {
  const result = await chrome.runtime.sendMessage({
    action: "fetchAPI",
    url: `https://pricegit.com/api/reverse-geocode?lat=${latitude}&lng=${longitude}`,
  });

  if (result.success && result.data.success) {
    return result.data.data;
  }

  throw new Error("Reverse geocode failed");
}

// ==========================================
// LLM ANALYSIS
// ==========================================

async function analyzeScreenshotAPI() {
  const authResult = await chrome.storage.local.get(["authToken"]);
  const authToken = authResult.authToken;

  if (!authToken) {
    throw new Error("LOGIN_REQUIRED");
  }

  const result = await chrome.runtime.sendMessage({
    action: "fetchAPI",
    url: "https://pricegit.com/api/analyze-screenshot",
    options: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        imageDataUrl: screenshotDataUrl,
        pageUrl: window.location.href,
        pageTitle: document.title,
      }),
    },
  });

  return result;
}

function handleAnalysisResult(result) {
  // Handle rate limiting
  if (result.status === 429) {
    const retryAfter = result.data?.error || "Rate limit exceeded. Please try again later.";
    showWarningModal("Rate Limit Reached", retryAfter, "OK");
    return;
  }

  // Handle expired session
  if (result.status === 401) {
    chrome.storage.local.remove(["authToken", "refreshToken", "username"]);
    chrome.runtime.sendMessage({ action: "clearWebAuth" });
    showSessionExpiredModal();
    return;
  }

  if (result.success && result.data.success) {
    const extracted = result.data.data;

    if (extracted.isInappropriate) {
      showWarningModal(
        "Inappropriate Content Detected",
        extracted.inappropriateReason ||
          "This screenshot appears to contain inappropriate content. Please capture a product page with pricing information.",
        "Try Again",
      );
      return;
    }

    if (!extracted.hasPrice) {
      showWarningModal(
        "No Price Detected",
        "We couldn't find a price on this page. Navigate to a page with:\n\n- A clearly visible price\n- The product name\n- Preferably on a checkout page with price breakdown\n\nThen click Capture Price again.",
        "OK",
        () => {},
      );
      return;
    }

    const hasBreakdown =
      extracted.shippingCost !== null || extracted.fees !== null;
    const isFinal = hasBreakdown ? extracted.isFinalPrice || false : false;

    formData = {
      price: extracted.totalPrice || extracted.basePrice || "",
      basePrice: extracted.itemPrice != null ? extracted.itemPrice : null,
      shippingCost: extracted.shippingCost != null ? extracted.shippingCost : null,
      fees: extracted.fees != null ? extracted.fees : null,
      currency: extracted.currency || "USD",
      productName: extracted.productName || "",
      isFinalPrice: isFinal,
      storeName: extractStoreName(),
      location: userLocation,
      screenshotDataUrl: screenshotDataUrl,
    };

    // Default selected URL to current page
    selectedProductUrl = window.location.href;
    showFormModal();
  } else {
    formData = {
      price: "",
      basePrice: null,
      shippingCost: null,
      fees: null,
      currency: "USD",
      productName: "",
      isFinalPrice: false,
      storeName: extractStoreName(),
      location: userLocation,
      screenshotDataUrl: screenshotDataUrl,
    };

    selectedProductUrl = window.location.href;
    showFormModal();
    console.error("PriceGit analysis failed:", JSON.stringify(result, null, 2));
    alert(
      "Could not automatically extract price details. Please fill in the form manually.",
    );
  }
}

function extractStoreName() {
  return window.location.hostname.replace("www.", "");
}

// ==========================================
// WARNING / SUCCESS / ERROR MODALS
// ==========================================

function showSuccessModal(title, message) {
  const existing = document.getElementById("pc-success-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "pc-success-modal";
  modal.innerHTML = `
    <div class="pc-modal-overlay">
      <div class="pc-success-modal-content">
        <div class="pc-success-checkmark">
          <svg viewBox="0 0 24 24">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <h2 class="pc-success-title">${title}</h2>
        <p class="pc-success-message">${message}</p>
        <button class="pc-success-btn" id="pc-success-ok">OK</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const handleOk = () => {
    modal.remove();
    document.removeEventListener("keydown", handleEscape);
  };

  document.getElementById("pc-success-ok").addEventListener("click", handleOk);

  const handleEscape = (e) => {
    if (e.key === "Escape") handleOk();
  };
  document.addEventListener("keydown", handleEscape);

  modal.querySelector(".pc-modal-overlay").addEventListener("click", (e) => {
    if (e.target.classList.contains("pc-modal-overlay")) handleOk();
  });
}

function showLocationRequiredModal() {
  const existing = document.getElementById("pc-location-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "pc-location-modal";
  modal.innerHTML = `
    <div class="pc-modal-overlay">
      <div class="pc-warning-modal-content">
        <div class="pc-location-icon">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
        </div>
        <h2 class="pc-warning-title">Enable location to capture price</h2>
        <p class="pc-warning-message">
          We need your location to show your prices to shoppers near you and prevent fraudulent submissions.
          Your location is only used when you capture prices—we never track your browsing.
        </p>
        <div class="pc-location-instructions">
          <p><strong>Quick setup:</strong></p>
          <p>1. Click the location icon in your browser's address bar</p>
          <p>2. Set "Location" to "Allow"</p>
          <p>3. Reload and capture away!</p>
        </div>
        <div class="pc-warning-buttons">
          <button class="pc-warning-btn-primary" id="pc-location-ok">Got It</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const handleOk = () => {
    modal.remove();
    document.removeEventListener("keydown", handleEscape);
  };

  document.getElementById("pc-location-ok").addEventListener("click", handleOk);

  const handleEscape = (e) => {
    if (e.key === "Escape") handleOk();
  };
  document.addEventListener("keydown", handleEscape);

  modal.querySelector(".pc-modal-overlay").addEventListener("click", (e) => {
    if (e.target.classList.contains("pc-modal-overlay")) handleOk();
  });
}

function showWarningModal(title, message, buttonText = "Try Again", onRetry = null) {
  const existing = document.getElementById("pc-warning-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "pc-warning-modal";
  modal.innerHTML = `
    <div class="pc-modal-overlay">
      <div class="pc-warning-modal-content">
        <h2 class="pc-warning-title">${title}</h2>
        <p class="pc-warning-message">${message.replace(/\n/g, "<br>")}</p>
        <div class="pc-warning-buttons">
          <button class="pc-warning-btn-primary" id="pc-warning-retry">${buttonText}</button>
          <button class="pc-warning-btn-secondary" id="pc-warning-cancel">Cancel</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById("pc-warning-retry").addEventListener("click", () => {
    modal.remove();
    if (onRetry) {
      onRetry();
    } else {
      startLLMCapture();
    }
  });

  document.getElementById("pc-warning-cancel").addEventListener("click", () => {
    modal.remove();
  });

  modal.querySelector(".pc-modal-overlay").addEventListener("click", (e) => {
    if (e.target.classList.contains("pc-modal-overlay")) modal.remove();
  });

  const handleEscape = (e) => {
    if (e.key === "Escape") {
      modal.remove();
      document.removeEventListener("keydown", handleEscape);
    }
  };
  document.addEventListener("keydown", handleEscape);
}

function showSessionExpiredModal() {
  const existing = document.getElementById("pc-warning-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "pc-warning-modal";
  const iconUrl = chrome.runtime.getURL("icon.png");
  modal.innerHTML = `
    <div class="pc-modal-overlay">
      <div class="pc-warning-modal-content">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
          <img src="${iconUrl}" alt="PriceGit" style="width:32px;height:32px;">
          <span style="font-size:18px;font-weight:700;color:#1a1a1a;">PriceGit</span>
        </div>
        <h2 class="pc-warning-title">Session Expired</h2>
        <p class="pc-warning-message">Your session has expired. Please sign in again to capture prices.</p>
        <div class="pc-warning-buttons">
          <a href="https://pricegit.com/login" target="_blank" class="pc-warning-btn-primary" id="pc-session-signin" style="text-decoration:none;text-align:center;color:#fff;">Sign In</a>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById("pc-session-signin").addEventListener("click", () => {
    modal.remove();
  });

  modal.querySelector(".pc-modal-overlay").addEventListener("click", (e) => {
    if (e.target.classList.contains("pc-modal-overlay")) modal.remove();
  });

  const handleEscape = (e) => {
    if (e.key === "Escape") {
      modal.remove();
      document.removeEventListener("keydown", handleEscape);
    }
  };
  document.addEventListener("keydown", handleEscape);
}

function showErrorModal(title, message, details = "") {
  const existing = document.getElementById("pc-error-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "pc-error-modal";

  const detailsHtml = details
    ? `<div class="pc-error-details">
         <p class="pc-error-details-label">Details:</p>
         <p class="pc-error-details-text">${details.replace(/\n/g, "<br>")}</p>
       </div>`
    : "";

  modal.innerHTML = `
    <div class="pc-modal-overlay">
      <div class="pc-warning-modal-content">
        <h2 class="pc-warning-title" style="color: #dc2626;">${title}</h2>
        <p class="pc-warning-message">${message.replace(/\n/g, "<br>")}</p>
        ${detailsHtml}
        <div class="pc-warning-buttons">
          <button class="pc-warning-btn-primary" id="pc-error-ok">OK</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById("pc-error-ok").addEventListener("click", () => {
    modal.remove();
  });

  modal.querySelector(".pc-modal-overlay").addEventListener("click", (e) => {
    if (e.target.classList.contains("pc-modal-overlay")) modal.remove();
  });

  const handleEscape = (e) => {
    if (e.key === "Escape") {
      modal.remove();
      document.removeEventListener("keydown", handleEscape);
    }
  };
  document.addEventListener("keydown", handleEscape);
}

// ==========================================
// ANALYZING OVERLAY
// ==========================================

function showAnalyzingOverlay(text = "Analyzing...") {
  hideAnalyzingOverlay();

  const overlay = document.createElement("div");
  overlay.id = "pc-analyzing-overlay";
  overlay.innerHTML = `
    <div class="pc-analyzing-content">
      <div class="pc-analyzing-spinner"></div>
      <p class="pc-analyzing-text">${text}</p>
    </div>
  `;
  document.body.appendChild(overlay);
}

function hideAnalyzingOverlay() {
  const overlay = document.getElementById("pc-analyzing-overlay");
  if (overlay) overlay.remove();
}

// ==========================================
// FORM MODAL
// ==========================================

function showFormModal() {
  const modal = document.createElement("div");
  modal.id = "price-commons-modal";
  modal.innerHTML = generateModalHTML();
  document.body.appendChild(modal);

  attachModalEventListeners();

  // Auto-search for product if LLM provided a name
  if (formData.productName && formData.productName.length >= 2) {
    searchProducts(formData.productName);
  }
}

function generateModalHTML() {
  const location = userLocation
    ? userLocation.fullAddress ||
      `${userLocation.city}, ${userLocation.country}`
    : "Location not available";

  const currency = formData.currency || "USD";
  const basePrice = formData.basePrice != null ? formData.basePrice : null;
  const shipping = formData.shippingCost != null ? formData.shippingCost : null;
  const fees = formData.fees != null ? formData.fees : null;
  const totalPrice = formData.price || null;

  // Truncate URL for display
  const currentUrl = window.location.href;
  const displayUrl = (() => {
    try {
      const parsed = new URL(currentUrl);
      const display = parsed.hostname + parsed.pathname + parsed.search;
      return display.length > 60 ? display.substring(0, 57) + "..." : display;
    } catch {
      return currentUrl.length > 60 ? currentUrl.substring(0, 57) + "..." : currentUrl;
    }
  })();

  return `
    <div class="pc-modal-overlay">
      <div class="pc-modal-content">
        <div class="pc-modal-header">
          <img src="${chrome.runtime.getURL(
            "icon.png",
          )}" alt="PriceGit" class="pc-header-icon">
          <span class="pc-header-title">Submit Price</span>
          <button id="pc-close-modal" class="pc-close-btn">&times;</button>
        </div>

        <div class="pc-modal-body">
          <div class="pc-price-breakdown-section">
            <h3 class="pc-breakdown-title">Captured Price</h3>
            <div class="pc-breakdown-grid">
              <div class="pc-breakdown-row">
                <span class="pc-breakdown-label">Base price:</span>
                <span class="pc-breakdown-value">${basePrice != null ? `${currency} ${basePrice.toFixed(2)}` : "\u2014"}</span>
              </div>
              <div class="pc-breakdown-row">
                <span class="pc-breakdown-label">Shipping:</span>
                <span class="pc-breakdown-value">${shipping != null ? `${currency} ${shipping.toFixed(2)}` : "\u2014"}</span>
              </div>
              <div class="pc-breakdown-row">
                <span class="pc-breakdown-label">Fees & taxes:</span>
                <span class="pc-breakdown-value">${fees != null ? `${currency} ${fees.toFixed(2)}` : "\u2014"}</span>
              </div>
              <div class="pc-breakdown-row pc-breakdown-total">
                <span class="pc-breakdown-label">Total:</span>
                <span class="pc-breakdown-value">${totalPrice != null ? `${currency} ${parseFloat(totalPrice).toFixed(2)}` : "\u2014"}</span>
              </div>
            </div>
          </div>

          <div class="pc-form-grid">
            <div class="pc-form-group pc-form-col-full">
              <label>Product</label>
              <div class="pc-search-container">
                <input type="text" id="pc-product-name" placeholder="Search or create product..." value="${
                  formData.productName || ""
                }" autocomplete="off">
                <div id="pc-product-dropdown" class="pc-dropdown"></div>
              </div>
            </div>

            <div class="pc-form-group pc-form-col-full">
              <label>Product Link</label>
              <div class="pc-url-input-wrapper">
                <input type="text" id="pc-product-url" value="${currentUrl}" readonly class="pc-url-readonly" autocomplete="off">
                <a href="${currentUrl}" target="_blank" rel="noopener noreferrer" class="pc-url-open-icon" id="pc-url-open-link" title="Open link">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <line x1="10" y1="14" x2="21" y2="3"></line>
                  </svg>
                </a>
              </div>
              <div class="pc-url-hint">Others will see this link - make sure it leads to the product page, not checkout</div>
              <label class="pc-checkbox-label pc-url-different-checkbox">
                <input type="checkbox" id="pc-different-url">
                <span class="pc-checkbox-custom"></span>
                <span class="pc-checkbox-text">Use a different link</span>
              </label>
              <div class="pc-url-error" id="pc-url-error" style="display: none;"></div>
            </div>

            <div class="pc-form-group pc-form-col-full">
              <label>Captured from</label>
              <div class="pc-search-container">
                <input type="text" id="pc-delivery-location" value="${location}" readonly class="pc-url-readonly" autocomplete="off">
                <div id="pc-delivery-dropdown" class="pc-dropdown"></div>
              </div>
              <label class="pc-checkbox-label pc-checkbox-group" style="margin-top: 8px;">
                <input type="checkbox" id="pc-different-shipping">
                <span class="pc-checkbox-custom"></span>
                <span class="pc-checkbox-text">Shipping address set to a different location</span>
              </label>
            </div>
          </div>
        </div>

        <div class="pc-modal-footer">
          <button id="pc-submit" class="pc-submit-btn">Submit Price</button>
        </div>
      </div>
    </div>
  `;
}

function attachModalEventListeners() {
  document
    .getElementById("pc-close-modal")
    .addEventListener("click", closeModal);

  const handleEscape = (e) => {
    if (e.key === "Escape") {
      closeModal();
    }
  };
  document.addEventListener("keydown", handleEscape);

  const originalCloseModal = window.closeModal;
  window.closeModal = function () {
    document.removeEventListener("keydown", handleEscape);
    if (originalCloseModal) originalCloseModal();
  };

  // Product search
  const productInput = document.getElementById("pc-product-name");
  let searchTimeout;
  productInput.addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();
    formData.productName = query;
    validateForm();

    if (query.length < 2) {
      document.getElementById("pc-product-dropdown").style.display = "none";
      return;
    }

    searchTimeout = setTimeout(() => searchProducts(query), 300);
  });

  // "Use a different link" checkbox
  const differentUrlCheckbox = document.getElementById("pc-different-url");
  const productUrlField = document.getElementById("pc-product-url");
  const urlOpenLink = document.getElementById("pc-url-open-link");
  const urlError = document.getElementById("pc-url-error");

  differentUrlCheckbox.addEventListener("change", (e) => {
    if (e.target.checked) {
      productUrlField.removeAttribute("readonly");
      productUrlField.classList.remove("pc-url-readonly");
      productUrlField.focus();
      productUrlField.select();
    } else {
      productUrlField.value = window.location.href;
      productUrlField.setAttribute("readonly", true);
      productUrlField.classList.add("pc-url-readonly");
      urlOpenLink.href = window.location.href;
      urlError.style.display = "none";
      selectedProductUrl = window.location.href;
    }
    validateForm();
  });

  productUrlField.addEventListener("input", () => {
    const value = productUrlField.value.trim();
    urlError.style.display = "none";

    if (!value) {
      selectedProductUrl = "";
      validateForm();
      return;
    }

    // Validate: must be http/https, same host
    if (!/^https?:\/\//i.test(value)) {
      urlError.textContent = "URL must start with https:// or http://";
      urlError.style.display = "block";
      selectedProductUrl = "";
      validateForm();
      return;
    }
    try {
      const parsed = new URL(value);
      if (parsed.hostname !== window.location.hostname) {
        urlError.textContent = `URL must be on ${window.location.hostname}`;
        urlError.style.display = "block";
        selectedProductUrl = "";
        validateForm();
        return;
      }
      selectedProductUrl = value;
      urlOpenLink.href = value;
    } catch {
      urlError.textContent = "Please enter a valid URL";
      urlError.style.display = "block";
      selectedProductUrl = "";
    }
    validateForm();
  });

  // Different shipping location toggle
  const differentShippingCheckbox = document.getElementById(
    "pc-different-shipping",
  );
  const deliveryLocationField = document.getElementById("pc-delivery-location");
  const originalLocation = deliveryLocationField.value;

  differentShippingCheckbox.addEventListener("change", (e) => {
    if (e.target.checked) {
      deliveryLocationField.value = "";
      deliveryLocationField.removeAttribute("readonly");
      deliveryLocationField.classList.remove("pc-url-readonly");
      deliveryLocationField.placeholder = "Search for city...";
      deliveryLocationField.focus();
      formData.deliveryLocation = null;
    } else {
      deliveryLocationField.value = originalLocation;
      deliveryLocationField.setAttribute("readonly", true);
      deliveryLocationField.classList.add("pc-url-readonly");
      deliveryLocationField.placeholder = "";
      formData.deliveryLocation = null;
      document.getElementById("pc-delivery-dropdown").style.display = "none";
    }
    validateForm();
  });

  // Delivery location search
  const deliveryInput = document.getElementById("pc-delivery-location");
  let deliverySearchTimeout;
  deliveryInput.addEventListener("input", (e) => {
    clearTimeout(deliverySearchTimeout);
    const query = e.target.value.trim();

    if (query.length < 2) {
      document.getElementById("pc-delivery-dropdown").style.display = "none";
      return;
    }

    deliverySearchTimeout = setTimeout(
      () => searchDeliveryLocations(query),
      300,
    );
  });

  // Submit
  document.getElementById("pc-submit").addEventListener("click", submitPrice);

  // Initial validation
  validateForm();
}

function validateForm() {
  const submitBtn = document.getElementById("pc-submit");
  if (!submitBtn) return;

  const hasProductName =
    formData.productName && formData.productName.trim().length > 0;

  const differentShipping = document.getElementById("pc-different-shipping");
  const needsDeliveryLocation = differentShipping && differentShipping.checked;
  const hasDeliveryLocation =
    formData.deliveryLocation && formData.deliveryLocation.city;

  const needsCaptureLocation = !userLocation;
  const hasCaptureLocation = formData.location && formData.location.city;

  const isValid =
    hasProductName &&
    (!needsDeliveryLocation || hasDeliveryLocation) &&
    (!needsCaptureLocation || hasCaptureLocation);

  submitBtn.disabled = !isValid;
  submitBtn.style.opacity = isValid ? "1" : "0.5";
  submitBtn.style.cursor = isValid ? "pointer" : "not-allowed";
}

async function searchProducts(query) {
  try {
    const result = await chrome.runtime.sendMessage({
      action: "fetchAPI",
      url: "https://pricegit.com/api/search-product",
      options: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      },
    });

    if (result.success) {
      displayProductDropdown(result.data.products || [], query);
    }
  } catch {
    // Product search failed — dropdown stays hidden
  }
}

function displayProductDropdown(products, query) {
  const dropdown = document.getElementById("pc-product-dropdown");
  dropdown.innerHTML = "";

  if (products.length === 0) {
    const createOption = document.createElement("div");
    createOption.className = "pc-dropdown-item pc-create-new";
    createOption.innerHTML = `Create new product: "${query}"`;
    createOption.addEventListener("click", () => {
      formData.productName = query;
      formData.productId = null;
      document.getElementById("pc-product-name").value = query;
      dropdown.style.display = "none";
      validateForm();
    });
    dropdown.appendChild(createOption);
  } else {
    products.forEach((product) => {
      const item = document.createElement("div");
      item.className = "pc-dropdown-item";
      item.textContent = product.name;
      item.addEventListener("click", () => {
        formData.productName = product.name;
        formData.productId = product.id;
        document.getElementById("pc-product-name").value = product.name;
        dropdown.style.display = "none";
        validateForm();
      });
      dropdown.appendChild(item);
    });

    const createOption = document.createElement("div");
    createOption.className = "pc-dropdown-item pc-create-new";
    createOption.innerHTML = `Create new product: "${query}"`;
    createOption.addEventListener("click", () => {
      formData.productName = query;
      formData.productId = null;
      document.getElementById("pc-product-name").value = query;
      dropdown.style.display = "none";
      validateForm();
    });
    dropdown.appendChild(createOption);
  }

  dropdown.style.display = "block";
}

async function searchDeliveryLocations(query) {
  try {
    const result = await chrome.runtime.sendMessage({
      action: "fetchAPI",
      url: `https://pricegit.com/api/geocode?q=${encodeURIComponent(query)}`,
      options: {
        method: "GET",
      },
    });

    if (result.success && result.data.features) {
      displayDeliveryDropdown(result.data.features);
    }
  } catch {
    // Delivery location search failed — dropdown stays hidden
  }
}

function displayDeliveryDropdown(locations) {
  const dropdown = document.getElementById("pc-delivery-dropdown");
  dropdown.innerHTML = "";

  if (locations.length === 0) {
    const noResults = document.createElement("div");
    noResults.className = "pc-dropdown-item pc-dropdown-no-results";
    noResults.textContent = "No locations found";
    dropdown.appendChild(noResults);
  } else {
    locations.forEach((location) => {
      const item = document.createElement("div");
      item.className = "pc-dropdown-item";
      item.textContent = location.place_name;
      item.addEventListener("click", () => {
        const [lng, lat] = location.center;
        formData.deliveryLocation = {
          city: location.text,
          country: extractCountryFromContext(location.context),
          fullAddress: location.place_name,
          latitude: lat,
          longitude: lng,
        };
        document.getElementById("pc-delivery-location").value =
          location.place_name;
        dropdown.style.display = "none";
        validateForm();
      });
      dropdown.appendChild(item);
    });
  }

  dropdown.style.display = "block";
}

function extractCountryFromContext(context) {
  if (!context) return "Unknown";
  const country = context.find((c) => c.id.startsWith("country."));
  return country ? country.text : "Unknown";
}

// ==========================================
// SUBMIT PRICE
// ==========================================

async function submitPrice() {
  if (!formData.productName || !formData.price) {
    alert("Please fill in all required fields (product name and price)");
    return;
  }

  if (!formData.location || !formData.location.city) {
    alert("Please select a capture location");
    return;
  }

  const differentShipping = document.getElementById("pc-different-shipping");
  if (
    differentShipping &&
    differentShipping.checked &&
    !formData.deliveryLocation
  ) {
    alert(
      "Please select a delivery location or uncheck 'Shipping to a different location'",
    );
    return;
  }

  const submitBtn = document.getElementById("pc-submit");
  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting...";

  try {
    const authResult = await chrome.storage.local.get(["authToken"]);
    const authToken = authResult.authToken;

    if (!authToken) {
      showWarningModal(
        "Sign-in Required",
        "Your session is missing or expired. Please sign in to the extension and try again.",
        "OK",
      );
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Price";
      return;
    }

    submitBtn.textContent = "Saving price...";

    // Determine the store name from the selected product URL
    let storeName = formData.storeName;
    if (selectedProductUrl) {
      try {
        storeName = new URL(selectedProductUrl).hostname.replace("www.", "");
      } catch {
        // Keep existing storeName
      }
    }

    const deliveryLoc = formData.deliveryLocation || formData.location;

    const payload = {
      productName: formData.productName,
      productId: formData.productId || null,
      storeName: storeName,
      price: parseFloat(formData.price),
      basePrice:
        formData.basePrice !== null ? parseFloat(formData.basePrice) : null,
      shippingCost:
        formData.shippingCost !== null
          ? parseFloat(formData.shippingCost)
          : null,
      fees: formData.fees !== null ? parseFloat(formData.fees) : null,
      currency: formData.currency,
      url: selectedProductUrl || window.location.href,
      captureUrl: window.location.href,
      location: {
        country: deliveryLoc.country,
        city: deliveryLoc.city,
        latitude: deliveryLoc.latitude,
        longitude: deliveryLoc.longitude,
      },
      captureLocation:
        formData.location && formData.deliveryLocation
          ? {
              country: formData.location.country,
              city: formData.location.city,
              latitude: formData.location.latitude,
              longitude: formData.location.longitude,
            }
          : null,
      isFinalPrice: formData.isFinalPrice || false,
    };

    const result = await chrome.runtime.sendMessage({
      action: "fetchAPI",
      url: "https://pricegit.com/api/save-price",
      options: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(payload),
      },
    });

    if (result.success && result.data.success) {
      // Clear state
      screenshotDataUrl = null;
      formData = {};
      selectedProductUrl = null;

      closeModal();
      showSuccessModal(
        "Price Submitted!",
        "Thank you for contributing to the community.",
      );
    } else {
      if (result.status === 401) {
        chrome.storage.local.remove(["authToken", "username"], () => {
          showWarningModal(
            "Session Expired",
            "Your session has expired. Please sign in again in the extension popup.",
            "OK",
          );
          closeModal();
        });
      } else {
        const errorMessage =
          result.data?.error || result.error || "Unknown error";
        const errorDetails = result.data?.details || "";
        showErrorModal("Failed to Submit Price", errorMessage, errorDetails);
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Price";
      }
    }
  } catch (error) {
    showErrorModal(
      "Failed to Submit Price",
      "An unexpected error occurred. Please try again.",
      error.message || "",
    );
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit Price";
  }
}

function closeModal() {
  const modal = document.getElementById("price-commons-modal");
  if (modal) modal.remove();
}
