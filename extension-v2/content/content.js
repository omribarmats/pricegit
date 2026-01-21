// Content script for price capture functionality

console.log("PriceGit content script loaded");

let captureMode = false;
let capturedPrice = null;
let formData = {};

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
function handlePriceClick(e) {
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

  const text = e.target.textContent.trim();
  console.log("Clicked element text:", text);

  // Try to extract number from text
  const priceMatch = text.match(/[\d,]+\.?\d*/);
  console.log("Price match result:", priceMatch);

  if (priceMatch) {
    capturedPrice = priceMatch[0].replace(/,/g, "");
    console.log("Captured price:", capturedPrice);

    // Remove the blue outline from the clicked element
    e.target.style.outline = "";
    e.target.style.outlineOffset = "";

    // Remove instruction overlay
    removeInstructionOverlay();

    // Stop capture mode
    captureMode = false;
    document.body.style.cursor = "default";
    document.removeEventListener("click", handlePriceClick, true);
    document.removeEventListener("mouseover", handlePriceHover, true);
    document.removeEventListener("mouseout", handlePriceHoverOut, true);

    // Load form data from storage or initialize
    loadFormData().then(() => {
      // Show form modal
      showFormModal();
    });
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

  const truncatedUrl = truncateUrl(formData.productUrl);

  return `
    <div class="pc-modal-overlay">
      <div class="pc-modal-content">
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
        
        <div class="pc-modal-body">
          <div class="pc-form-group">
            <label>Final Price</label>
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
                formData.productName
              }" autocomplete="off">
              <div id="pc-product-dropdown" class="pc-dropdown"></div>
            </div>
          </div>
          
          <div class="pc-form-group">
            <label>Store name</label>
            <input type="text" id="pc-store-name" value="${
              formData.storeName
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
    closeModal();
    startPriceCapture();
  });

  // Submit
  document.getElementById("pc-submit").addEventListener("click", submitPrice);

  // URL change
  document.getElementById("pc-product-url").addEventListener("input", (e) => {
    formData.productUrl = e.target.value;
    saveFormData();
  });
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
    const payload = {
      productName: formData.productName,
      productId: formData.productId,
      storeName: formData.storeName,
      price: parseFloat(formData.price),
      currency: formData.currency,
      url: formData.productUrl,
      location: formData.location,
    };

    const result = await chrome.runtime.sendMessage({
      action: "fetchAPI",
      url: "http://localhost:3000/api/save-price",
      options: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    });

    if (result.success && result.data.success) {
      // Clear form data
      chrome.storage.local.remove(["priceCommonsCaptureForm"]);

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
