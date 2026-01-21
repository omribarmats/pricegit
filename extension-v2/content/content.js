// Content script for price capture functionality

console.log("PriceGit content script loaded");

let captureMode = false;
let capturedPrice = null;
let formData = {};

// Screenshot state
let screenshotDataUrl = null;
let capturedElement = null;

// Blur tool state
let blurRectangles = [];
let isDrawingBlur = false;
let blurStartX = 0;
let blurStartY = 0;
let originalScreenshotImage = null;

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Message received:", request);
  if (request.action === "startPriceCapture") {
    console.log("Starting price capture");
    startPriceCapture();
    sendResponse({ success: true });
  } else if (request.action === "openPriceModal") {
    console.log("Opening price modal directly");
    loadFormData().then(() => {
      showFormModal();
      sendResponse({ success: true });
    });
    return true; // Keep channel open for async response
  }
  return true;
});

// Start price capture mode
function startPriceCapture() {
  console.log("Price capture mode activated");
  captureMode = true;
  document.body.style.cursor = "crosshair";

  // Add click listener for price capture
  document.addEventListener("click", handlePriceClick, true);

  // Add hover listener for highlighting
  document.addEventListener("mouseover", handlePriceHover, true);
  document.addEventListener("mouseout", handlePriceHoverOut, true);

  // Show instruction overlay
  showInstructionOverlay();
  console.log("Instruction overlay shown, listeners attached");
}

// Handle hover for highlighting
function handlePriceHover(e) {
  if (!captureMode) return;

  // Don't highlight our own UI
  if (
    e.target.closest("#price-commons-instruction") ||
    e.target.closest("#price-commons-modal")
  ) {
    return;
  }

  console.log("Hovering over:", e.target);
  e.target.style.outline = "3px solid #2563eb";
  e.target.style.outlineOffset = "2px";
}

// Handle hover out
function handlePriceHoverOut(e) {
  if (!captureMode) return;

  e.target.style.outline = "";
  e.target.style.outlineOffset = "";
}

// Handle price click
async function handlePriceClick(e) {
  console.log("Click detected on:", e.target);

  if (!captureMode) {
    console.log("Not in capture mode, ignoring click");
    return;
  }

  // Don't capture clicks on our own UI elements
  if (
    e.target.closest("#price-commons-instruction") ||
    e.target.closest("#price-commons-modal")
  ) {
    console.log("Click on our own UI, ignoring");
    return;
  }

  e.preventDefault();
  e.stopPropagation();

  const text = e.target.textContent.trim();
  console.log("Clicked element text:", text);

  // Try to extract number from text
  const priceMatch = text.match(/[\d,]+\.?\d*/);
  console.log("Price match result:", priceMatch);

  if (priceMatch) {
    capturedPrice = priceMatch[0].replace(/,/g, "");
    console.log("Captured price:", capturedPrice);

    // Store reference to captured element
    capturedElement = e.target;

    // KEEP the blue outline visible for screenshot
    // The outline is already applied from hover

    // Remove instruction overlay but keep highlight
    removeInstructionOverlay();

    // Stop capture mode listeners (but keep highlight)
    captureMode = false;
    document.body.style.cursor = "default";
    document.removeEventListener("click", handlePriceClick, true);
    document.removeEventListener("mouseover", handlePriceHover, true);
    document.removeEventListener("mouseout", handlePriceHoverOut, true);

    // Capture screenshot with element highlighted
    try {
      console.log("Requesting screenshot...");
      const response = await chrome.runtime.sendMessage({ action: "captureScreenshot" });
      if (response.success) {
        screenshotDataUrl = response.dataUrl;
        console.log("Screenshot captured successfully");
      } else {
        console.error("Screenshot capture failed:", response.error);
      }
    } catch (error) {
      console.error("Screenshot capture error:", error);
      // Continue without screenshot - it's optional
    }

    // NOW remove the highlight
    if (capturedElement) {
      capturedElement.style.outline = "";
      capturedElement.style.outlineOffset = "";
    }

    // Load form data from storage or initialize
    await loadFormData();

    // Show form modal
    showFormModal();
  }
}

// Load form data from localStorage
async function loadFormData() {
  const result = await chrome.storage.local.get(["priceCommonsCaptureForm"]);
  const saved = result.priceCommonsCaptureForm;

  if (saved) {
    formData = saved;
  } else {
    formData = {
      storeName: extractStoreName(),
      productName: "",
      productUrl: window.location.href,
      location: null,
      currency: "USD",
      price: capturedPrice,
    };
  }

  // Update price with captured value
  formData.price = capturedPrice;
  formData.productUrl = window.location.href;
  formData.storeName = extractStoreName();
}

// Save form data to localStorage
function saveFormData() {
  chrome.storage.local.set({ priceCommonsCaptureForm: formData });
}

// Extract store name from URL
function extractStoreName() {
  const hostname = window.location.hostname;
  const domain = hostname.replace("www.", "");

  // Get country from user location if available
  const userLocation = JSON.parse(localStorage.getItem("userLocation") || "{}");
  const country = userLocation.country || "";

  // Return domain with country suffix if we have country
  if (country) {
    return `${domain} ${country}`;
  }

  return domain;
}

// Show instruction overlay
function showInstructionOverlay() {
  const overlay = document.createElement("div");
  overlay.id = "price-commons-instruction";
  overlay.innerHTML = `
    <div class="pc-instruction-content">
      <p>Click on the price to capture it</p>
      <button id="pc-cancel-capture" type="button">Cancel</button>
    </div>
  `;
  document.body.appendChild(overlay);

  const cancelBtn = document.getElementById("pc-cancel-capture");
  cancelBtn.addEventListener("click", handleCancelCapture, { capture: true });
}

// Handle cancel capture
function handleCancelCapture(e) {
  e.preventDefault();
  e.stopPropagation();
  captureMode = false;
  document.body.style.cursor = "default";
  document.removeEventListener("click", handlePriceClick, true);
  document.removeEventListener("mouseover", handlePriceHover, true);
  document.removeEventListener("mouseout", handlePriceHoverOut, true);
  removeInstructionOverlay();
}

// Remove instruction overlay
function removeInstructionOverlay() {
  const overlay = document.getElementById("price-commons-instruction");
  if (overlay) overlay.remove();
}

// Show form modal
function showFormModal() {
  // Load user location from chrome storage
  chrome.storage.local.get(["userLocation"], (result) => {
    if (result.userLocation) {
      formData.location = result.userLocation;
    }

    const modal = document.createElement("div");
    modal.id = "price-commons-modal";
    modal.innerHTML = generateModalHTML();
    document.body.appendChild(modal);

    attachModalEventListeners();
  });
}

// Generate modal HTML
function generateModalHTML() {
  const location = formData.location
    ? formData.location.fullAddress ||
      `${formData.location.city}, ${formData.location.country}`
    : "Not set";

  const hasScreenshot = !!screenshotDataUrl;

  return `
    <div class="pc-modal-overlay">
      <div class="pc-modal-content ${hasScreenshot ? 'pc-modal-wide' : ''}">
        <div class="pc-modal-header">
          <img src="${chrome.runtime.getURL(
            "icon.png"
          )}" alt="PriceGit" class="pc-header-icon">
          <div class="pc-header-text">
            <h1>PriceGit</h1>
            <p>Shared Price Knowledge</p>
          </div>
          <button id="pc-close-modal" class="pc-close-btn">×</button>
        </div>

        <div class="pc-modal-body ${hasScreenshot ? 'pc-modal-body-split' : ''}">
          ${hasScreenshot ? `
          <!-- Screenshot Panel (Left) -->
          <div class="pc-screenshot-panel">
            <div class="pc-screenshot-header">
              <span>Screenshot</span>
              <div class="pc-screenshot-tools">
                <button id="pc-blur-tool" class="pc-tool-btn pc-tool-active" title="Draw blur rectangle">
                  Blur Tool
                </button>
                <button id="pc-undo-blur" class="pc-tool-btn" title="Undo last blur">
                  Undo
                </button>
                <button id="pc-clear-blurs" class="pc-tool-btn" title="Clear all blurs">
                  Clear
                </button>
              </div>
            </div>
            <div class="pc-screenshot-container">
              <canvas id="pc-screenshot-canvas"></canvas>
            </div>
            <p class="pc-screenshot-hint">Draw rectangles to blur sensitive information</p>
          </div>
          ` : ''}

          <!-- Form Panel (Right or Full) -->
          <div class="pc-form-panel">
            <div class="pc-form-group">
              <label>Price</label>
              <div class="pc-price-currency-row">
                <div class="pc-price-display">
                  <input type="text" id="pc-price" value="${
                    formData.price || ""
                  }" readonly disabled>
                  <button id="pc-recapture" class="pc-recapture-btn" title="Recapture price">🖱️</button>
                </div>
                <select id="pc-currency" class="pc-currency-select">
                  ${generateCurrencyOptions()}
                </select>
              </div>
            </div>

            <div class="pc-form-group">
              <label>Product</label>
              <div class="pc-search-container">
                <input type="text" id="pc-product-name" placeholder="Search for product..." value="${
                  formData.productName || ""
                }" autocomplete="off">
                <div id="pc-product-dropdown" class="pc-dropdown"></div>
              </div>
            </div>

            <div class="pc-form-group">
              <label class="pc-toggle-label">
                <input type="checkbox" id="pc-is-final-price" ${formData.isFinalPrice ? 'checked' : ''}>
                <span>This is the final price (includes tax, shipping, fees)</span>
              </label>
            </div>

            <div class="pc-form-group">
              <label>Store name</label>
              <input type="text" id="pc-store-name" value="${
                formData.storeName || ""
              }" readonly disabled>
            </div>

            <div class="pc-form-group">
              <label>Shipping Address</label>
              <div class="pc-location-display">
                <span id="pc-location-text">${location}</span>
                <button id="pc-edit-location" class="pc-edit-btn">Edit</button>
              </div>
            </div>
          </div>
        </div>

        <div class="pc-modal-footer">
          <button id="pc-submit" class="pc-submit-btn">Submit</button>
        </div>
      </div>
    </div>
  `;
}

// Truncate URL for display
function truncateUrl(url) {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    if (path.length > 30) {
      return urlObj.hostname + "/.../" + path.split("/").pop();
    }
    return urlObj.hostname + path;
  } catch {
    return url;
  }
}

// Generate currency dropdown options
function generateCurrencyOptions() {
  const currencies = [
    "USD",
    "EUR",
    "GBP",
    "JPY",
    "CNY",
    "AUD",
    "CAD",
    "CHF",
    "ILS",
    "INR",
    "BRL",
    "RUB",
    "KRW",
    "MXN",
    "SGD",
    "HKD",
    "NOK",
    "SEK",
    "DKK",
    "PLN",
    "THB",
    "IDR",
    "HUF",
    "CZK",
    "NZD",
    "ZAR",
    "TRY",
    "AED",
    "SAR",
    "MYR",
  ];

  return currencies
    .map(
      (code) =>
        `<option value="${code}" ${
          formData.currency === code ? "selected" : ""
        }>${code}</option>`
    )
    .join("");
}

// Attach event listeners to modal
function attachModalEventListeners() {
  // Close modal
  document
    .getElementById("pc-close-modal")
    .addEventListener("click", closeModal);

  // Product search
  const productInput = document.getElementById("pc-product-name");
  let searchTimeout;
  productInput.addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();

    if (query.length < 2) {
      document.getElementById("pc-product-dropdown").style.display = "none";
      return;
    }

    searchTimeout = setTimeout(() => searchProducts(query), 300);
  });

  // Edit location
  document
    .getElementById("pc-edit-location")
    .addEventListener("click", openLocationModal);

  // Currency change
  document.getElementById("pc-currency").addEventListener("change", (e) => {
    formData.currency = e.target.value;
    saveFormData();
  });

  // Recapture price
  document.getElementById("pc-recapture").addEventListener("click", () => {
    // Reset screenshot state when recapturing
    screenshotDataUrl = null;
    blurRectangles = [];
    originalScreenshotImage = null;
    closeModal();
    startPriceCapture();
  });

  // Submit
  document.getElementById("pc-submit").addEventListener("click", submitPrice);

  // is_final_price toggle
  const finalPriceCheckbox = document.getElementById("pc-is-final-price");
  if (finalPriceCheckbox) {
    finalPriceCheckbox.addEventListener("change", (e) => {
      formData.isFinalPrice = e.target.checked;
      saveFormData();
    });
  }

  // Screenshot tools (if screenshot panel exists)
  const undoBtn = document.getElementById("pc-undo-blur");
  const clearBtn = document.getElementById("pc-clear-blurs");

  if (undoBtn) {
    undoBtn.addEventListener("click", undoLastBlur);
  }
  if (clearBtn) {
    clearBtn.addEventListener("click", clearAllBlurs);
  }

  // Initialize canvas if screenshot exists
  if (screenshotDataUrl) {
    initializeScreenshotCanvas();
  }
}

// Search products
async function searchProducts(query) {
  try {
    const result = await chrome.runtime.sendMessage({
      action: "fetchAPI",
      url: "http://localhost:3000/api/search-product",
      options: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      },
    });

    if (result.success) {
      displayProductDropdown(result.data.products || [], query);
    } else {
      console.error("Product search error:", result.error || result.data);
    }
  } catch (error) {
    console.error("Product search error:", error);
  }
}

// Display product dropdown
function displayProductDropdown(products, query) {
  const dropdown = document.getElementById("pc-product-dropdown");
  dropdown.innerHTML = "";

  if (products.length === 0) {
    // Show create new option
    const createOption = document.createElement("div");
    createOption.className = "pc-dropdown-item pc-create-new";
    createOption.innerHTML = `➕ Create new product: "${query}"`;
    createOption.addEventListener("click", () => {
      formData.productName = query;
      formData.productId = null;
      document.getElementById("pc-product-name").value = query;
      dropdown.style.display = "none";
      saveFormData();
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
        saveFormData();
      });
      dropdown.appendChild(item);
    });
  }

  dropdown.style.display = "block";
}

// Location modal state
let tempSelectedLocation = null;
let locationSearchTimeout = null;

// Open location modal
function openLocationModal() {
  const locationModal = document.createElement("div");
  locationModal.id = "pc-location-modal";
  locationModal.innerHTML = generateLocationModalHTML();
  document.body.appendChild(locationModal);

  attachLocationModalListeners();
}

// Generate location modal HTML
function generateLocationModalHTML() {
  const currentLocation = formData.location
    ? `${formData.location.city}, ${formData.location.country}`
    : "";

  return `
    <div class="pc-modal-overlay" id="pc-location-overlay">
      <div class="pc-location-modal-content">
        <div class="pc-location-header">
          <h3>Edit Location</h3>
          <button id="pc-close-location-modal" class="pc-close-btn">×</button>
        </div>
        <div class="pc-location-body">
          <label for="pc-location-search" class="pc-location-label">Search for your address or city</label>
          <input 
            type="text" 
            id="pc-location-search" 
            placeholder="e.g., Tel Aviv, Israel or 123 Main St, New York"
            autocomplete="off"
            value="${currentLocation}"
          >
          <div id="pc-location-suggestions" class="pc-location-suggestions" style="display: none;"></div>
          <div id="pc-location-error" class="pc-location-error" style="display: none;"></div>
          <div id="pc-selected-location-display" class="pc-selected-location-display" style="display: none;">
            <div class="pc-selected-label">Selected Location:</div>
            <div id="pc-selected-location-text" class="pc-selected-location-text"></div>
          </div>
        </div>
        <div class="pc-location-footer">
          <button id="pc-save-location" class="pc-btn-save" disabled>Save Location</button>
          <button id="pc-cancel-location" class="pc-btn-cancel">Cancel</button>
        </div>
      </div>
    </div>
  `;
}

// Attach location modal event listeners
function attachLocationModalListeners() {
  const closeBtn = document.getElementById("pc-close-location-modal");
  const cancelBtn = document.getElementById("pc-cancel-location");
  const saveBtn = document.getElementById("pc-save-location");
  const locationSearch = document.getElementById("pc-location-search");
  const overlay = document.getElementById("pc-location-overlay");

  closeBtn.addEventListener("click", closeLocationModal);
  cancelBtn.addEventListener("click", closeLocationModal);
  saveBtn.addEventListener("click", saveLocationSelection);
  locationSearch.addEventListener("input", handleLocationSearchInput);

  // Close on overlay click
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      closeLocationModal();
    }
  });
}

// Handle location search input
function handleLocationSearchInput(e) {
  const query = e.target.value.trim();

  if (locationSearchTimeout) {
    clearTimeout(locationSearchTimeout);
  }

  const suggestionsDiv = document.getElementById("pc-location-suggestions");
  const errorDiv = document.getElementById("pc-location-error");

  if (query.length < 3) {
    suggestionsDiv.style.display = "none";
    errorDiv.style.display = "none";
    return;
  }

  locationSearchTimeout = setTimeout(() => {
    searchLocation(query);
  }, 300);
}

// Search location via geocode API
async function searchLocation(query) {
  const errorDiv = document.getElementById("pc-location-error");
  errorDiv.style.display = "none";

  try {
    const result = await chrome.runtime.sendMessage({
      action: "fetchAPI",
      url: `http://localhost:3000/api/geocode?q=${encodeURIComponent(query)}`,
    });

    if (!result.success) {
      if (result.status === 429) {
        showLocationError(
          result.data?.message || "Rate limit exceeded. Please try again later."
        );
      } else {
        showLocationError(
          "Failed to fetch location suggestions. Please try again."
        );
      }
      return;
    }

    displayLocationSuggestions(result.data.features || []);
  } catch (error) {
    console.error("Error fetching location suggestions:", error);
    showLocationError(
      "Failed to fetch location suggestions. Please try again."
    );
  }
}

// Display location suggestions
function displayLocationSuggestions(suggestions) {
  const suggestionsDiv = document.getElementById("pc-location-suggestions");

  if (suggestions.length === 0) {
    suggestionsDiv.style.display = "none";
    return;
  }

  suggestionsDiv.innerHTML = "";

  suggestions.forEach((suggestion) => {
    const item = document.createElement("div");
    item.className = "pc-location-suggestion-item";
    item.textContent = suggestion.place_name;

    item.addEventListener("click", () => {
      selectLocation(suggestion);
    });

    suggestionsDiv.appendChild(item);
  });

  suggestionsDiv.style.display = "block";
}

// Select a location suggestion
function selectLocation(suggestion) {
  const [longitude, latitude] = suggestion.center;
  const parts = suggestion.place_name.split(", ");

  // Handle different address formats:
  // - "City, Country" (2 parts) -> city = parts[0]
  // - "Street, City, Country" (3+ parts) -> city = parts[1]
  let city, country;

  if (parts.length >= 3) {
    // Street address format: use second part as city
    city = parts[1];
    country = parts[parts.length - 1];
  } else {
    // City format: use first part as city
    city = parts[0];
    country = parts[parts.length - 1];
  }

  tempSelectedLocation = {
    country,
    city,
    latitude,
    longitude,
    fullAddress: suggestion.place_name, // Store the complete address
  };

  const locationSearch = document.getElementById("pc-location-search");
  const suggestionsDiv = document.getElementById("pc-location-suggestions");
  const selectedDisplay = document.getElementById(
    "pc-selected-location-display"
  );
  const selectedText = document.getElementById("pc-selected-location-text");
  const saveBtn = document.getElementById("pc-save-location");

  locationSearch.value = suggestion.place_name;
  suggestionsDiv.style.display = "none";
  selectedText.textContent = suggestion.place_name; // Display full address
  selectedDisplay.style.display = "block";
  saveBtn.disabled = false;
}

// Show location error
function showLocationError(message) {
  const errorDiv = document.getElementById("pc-location-error");
  const suggestionsDiv = document.getElementById("pc-location-suggestions");

  errorDiv.textContent = message;
  errorDiv.style.display = "block";
  suggestionsDiv.style.display = "none";
}

// Save location selection
async function saveLocationSelection() {
  if (!tempSelectedLocation) return;

  formData.location = { ...tempSelectedLocation };

  // Save to chrome.storage.local
  try {
    await chrome.storage.local.set({ userLocation: formData.location });
    console.log("Location saved to storage");
  } catch (error) {
    console.error("Error saving location:", error);
  }

  saveFormData();

  // Update location display in main modal
  const locationText = document.getElementById("pc-location-text");
  if (locationText) {
    locationText.textContent =
      formData.location.fullAddress ||
      `${formData.location.city}, ${formData.location.country}`;
  }

  closeLocationModal();
}

// Close location modal
function closeLocationModal() {
  const modal = document.getElementById("pc-location-modal");
  if (modal) modal.remove();

  tempSelectedLocation = null;
  locationSearchTimeout = null;
}

// Submit price
async function submitPrice() {
  if (!formData.productName || !formData.price || !formData.location) {
    alert("Please fill in all required fields");
    return;
  }

  const submitBtn = document.getElementById("pc-submit");
  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting...";

  try {
    // Get auth token
    const authResult = await chrome.storage.local.get(["authToken"]);
    const authToken = authResult.authToken;

    let uploadedScreenshotUrl = null;

    // Upload screenshot if available
    if (screenshotDataUrl) {
      submitBtn.textContent = "Uploading screenshot...";

      const processedScreenshot = getProcessedScreenshotDataUrl();

      if (processedScreenshot) {
        try {
          const uploadResult = await chrome.runtime.sendMessage({
            action: "fetchAPI",
            url: "http://localhost:3000/api/upload-screenshot",
            options: {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(authToken ? { "Authorization": `Bearer ${authToken}` } : {}),
              },
              body: JSON.stringify({ imageDataUrl: processedScreenshot }),
            },
          });

          if (uploadResult.success && uploadResult.data.success) {
            uploadedScreenshotUrl = uploadResult.data.screenshotUrl;
            console.log("Screenshot uploaded:", uploadedScreenshotUrl);
          } else {
            console.warn("Screenshot upload failed, continuing without screenshot:", uploadResult);
          }
        } catch (uploadError) {
          console.warn("Screenshot upload error, continuing without screenshot:", uploadError);
        }
      }
    }

    submitBtn.textContent = "Saving price...";

    const payload = {
      productName: formData.productName,
      productId: formData.productId,
      storeName: formData.storeName,
      price: parseFloat(formData.price),
      currency: formData.currency,
      url: formData.productUrl,
      location: formData.location,
      isFinalPrice: formData.isFinalPrice || false,
      screenshotUrl: uploadedScreenshotUrl,
    };

    const result = await chrome.runtime.sendMessage({
      action: "fetchAPI",
      url: "http://localhost:3000/api/save-price",
      options: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { "Authorization": `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify(payload),
      },
    });

    if (result.success && result.data.success) {
      // Clear form data and screenshot state
      chrome.storage.local.remove(["priceCommonsCaptureForm"]);
      screenshotDataUrl = null;
      blurRectangles = [];
      originalScreenshotImage = null;

      // Show success message
      alert("Price submitted successfully!");
      closeModal();
    } else {
      alert(
        "Failed to submit price: " +
          (result.data?.error || result.error || "Unknown error")
      );
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit";
    }
  } catch (error) {
    console.error("Submit error:", error);
    alert("Failed to submit price. Please try again.");
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit";
  }
}

// Close modal
function closeModal() {
  const modal = document.getElementById("price-commons-modal");
  if (modal) modal.remove();
}

// ==========================================
// SCREENSHOT CANVAS AND BLUR TOOL FUNCTIONS
// ==========================================

// Initialize screenshot canvas
function initializeScreenshotCanvas() {
  const canvas = document.getElementById('pc-screenshot-canvas');
  if (!canvas || !screenshotDataUrl) return;

  const ctx = canvas.getContext('2d');
  const img = new Image();

  img.onload = function() {
    // Store original image for redrawing
    originalScreenshotImage = img;

    // Calculate display size (fit within container, max ~400px width)
    const maxWidth = 400;
    const scale = Math.min(1, maxWidth / img.width);
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;

    // Store scale for coordinate conversion
    canvas.dataset.scale = scale;
    canvas.dataset.originalWidth = img.width;
    canvas.dataset.originalHeight = img.height;

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Attach event listeners for blur drawing
    attachBlurEventListeners(canvas);
  };

  img.src = screenshotDataUrl;
}

// Attach blur event listeners to canvas
function attachBlurEventListeners(canvas) {
  canvas.addEventListener('mousedown', startBlurDraw);
  canvas.addEventListener('mousemove', drawBlurPreview);
  canvas.addEventListener('mouseup', finishBlurDraw);
  canvas.addEventListener('mouseleave', cancelBlurDraw);
}

// Start drawing blur rectangle
function startBlurDraw(e) {
  const canvas = e.target;
  const rect = canvas.getBoundingClientRect();
  isDrawingBlur = true;
  blurStartX = e.clientX - rect.left;
  blurStartY = e.clientY - rect.top;
}

// Draw blur preview while dragging
function drawBlurPreview(e) {
  if (!isDrawingBlur) return;

  const canvas = e.target;
  const rect = canvas.getBoundingClientRect();
  const currentX = e.clientX - rect.left;
  const currentY = e.clientY - rect.top;

  // Redraw canvas with existing blurs + preview
  redrawCanvasWithBlurs(canvas, {
    x: Math.min(blurStartX, currentX),
    y: Math.min(blurStartY, currentY),
    width: Math.abs(currentX - blurStartX),
    height: Math.abs(currentY - blurStartY),
    isPreview: true
  });
}

// Finish drawing blur rectangle
function finishBlurDraw(e) {
  if (!isDrawingBlur) return;

  const canvas = e.target;
  const rect = canvas.getBoundingClientRect();
  const endX = e.clientX - rect.left;
  const endY = e.clientY - rect.top;

  // Only add if rectangle is meaningful (> 5px in both dimensions)
  const width = Math.abs(endX - blurStartX);
  const height = Math.abs(endY - blurStartY);

  if (width > 5 && height > 5) {
    blurRectangles.push({
      x: Math.min(blurStartX, endX),
      y: Math.min(blurStartY, endY),
      width: width,
      height: height
    });
  }

  isDrawingBlur = false;
  redrawCanvasWithBlurs(canvas);
}

// Cancel blur drawing (mouse left canvas)
function cancelBlurDraw() {
  isDrawingBlur = false;
  const canvas = document.getElementById('pc-screenshot-canvas');
  if (canvas) redrawCanvasWithBlurs(canvas);
}

// Redraw canvas with all blur rectangles
function redrawCanvasWithBlurs(canvas, previewRect = null) {
  if (!originalScreenshotImage) return;

  const ctx = canvas.getContext('2d');

  // Redraw original image
  ctx.drawImage(originalScreenshotImage, 0, 0, canvas.width, canvas.height);

  // Apply blur to each rectangle
  const allRects = previewRect ? [...blurRectangles, previewRect] : blurRectangles;

  allRects.forEach(rect => {
    // Ensure rect is within canvas bounds
    const x = Math.max(0, Math.floor(rect.x));
    const y = Math.max(0, Math.floor(rect.y));
    const w = Math.min(Math.floor(rect.width), canvas.width - x);
    const h = Math.min(Math.floor(rect.height), canvas.height - y);

    if (w <= 0 || h <= 0) return;

    // Use pixelation as blur effect (canvas-friendly)
    const pixelSize = 10;
    const imgData = ctx.getImageData(x, y, w, h);

    // Simple pixelation blur
    for (let py = 0; py < h; py += pixelSize) {
      for (let px = 0; px < w; px += pixelSize) {
        const pixelIndex = (py * w + px) * 4;

        // Get color from this pixel
        const r = imgData.data[pixelIndex] || 0;
        const g = imgData.data[pixelIndex + 1] || 0;
        const b = imgData.data[pixelIndex + 2] || 0;

        // Fill the block with this color
        for (let by = 0; by < pixelSize && py + by < h; by++) {
          for (let bx = 0; bx < pixelSize && px + bx < w; bx++) {
            const idx = ((py + by) * w + (px + bx)) * 4;
            imgData.data[idx] = r;
            imgData.data[idx + 1] = g;
            imgData.data[idx + 2] = b;
          }
        }
      }
    }

    ctx.putImageData(imgData, x, y);

    // Draw preview border if this is a preview rect
    if (rect.isPreview) {
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
      ctx.setLineDash([]);
    }
  });
}

// Undo last blur rectangle
function undoLastBlur() {
  blurRectangles.pop();
  const canvas = document.getElementById('pc-screenshot-canvas');
  if (canvas) redrawCanvasWithBlurs(canvas);
}

// Clear all blur rectangles
function clearAllBlurs() {
  blurRectangles = [];
  const canvas = document.getElementById('pc-screenshot-canvas');
  if (canvas) redrawCanvasWithBlurs(canvas);
}

// Get processed screenshot data URL (with blurs applied)
function getProcessedScreenshotDataUrl() {
  const canvas = document.getElementById('pc-screenshot-canvas');
  if (!canvas) return null;
  return canvas.toDataURL('image/png');
}
