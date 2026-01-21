// DOM Elements
const searchInput = document.getElementById("search-input");
const clearBtn = document.getElementById("clear-btn");
const searchDropdown = document.getElementById("search-dropdown");
const emptyState = document.getElementById("empty-state");
const productResults = document.getElementById("product-results");
const productName = document.getElementById("product-name");
const alternativesList = document.getElementById("alternatives-list");
const locationInfo = document.getElementById("location-info");
const editLocationBtn = document.getElementById("edit-location-btn");
const locationModal = document.getElementById("location-modal");
const closeModalBtn = document.getElementById("close-modal-btn");
const locationSearch = document.getElementById("location-search");
const locationSuggestions = document.getElementById("location-suggestions");
const locationError = document.getElementById("location-error");
const selectedLocationDisplay = document.getElementById(
  "selected-location-display"
);
const selectedLocationText = document.getElementById("selected-location-text");
const saveLocationBtn = document.getElementById("save-location-btn");
const cancelLocationBtn = document.getElementById("cancel-location-btn");

console.log("Popup script loaded");

// State
let searchTimeout;
let locationSearchTimeout;
let selectedProduct = null;
let userLocation = null;
let tempSelectedLocation = null;

// Initialize
initLocation();
searchInput.addEventListener("input", handleSearchInput);
clearBtn.addEventListener("click", handleClear);
editLocationBtn.addEventListener("click", openLocationModal);
closeModalBtn.addEventListener("click", closeLocationModal);
cancelLocationBtn.addEventListener("click", closeLocationModal);
locationSearch.addEventListener("input", handleLocationSearch);
saveLocationBtn.addEventListener("click", saveLocation);

// Initialize location
async function initLocation() {
  console.log("initLocation called");
  // Try to load from chrome.storage first
  try {
    const result = await chrome.storage.local.get(["userLocation"]);
    console.log("Loaded from storage:", result);
    if (result.userLocation) {
      userLocation = result.userLocation;
      console.log("Using stored location:", userLocation);
      updateLocationDisplay();
      return;
    }
  } catch (error) {
    console.error("Error loading location from storage:", error);
  }

  // Fallback to hardcoded for testing
  console.log("No stored location, using default");
  userLocation = {
    country: "Israel",
    city: "Tel Aviv",
  };
  updateLocationDisplay();
}

// Update location display
function updateLocationDisplay() {
  if (userLocation) {
    const location = userLocation.city
      ? `${userLocation.city}, ${userLocation.country}`
      : userLocation.country;
    locationInfo.textContent = `Showing prices for: ${location}`;
  }
}

// Close dropdown when clicking outside
document.addEventListener("click", (e) => {
  if (!searchDropdown.contains(e.target) && e.target !== searchInput) {
    searchDropdown.style.display = "none";
  }
});

// Handle search input
function handleSearchInput(e) {
  const query = e.target.value.trim();

  // Show/hide clear button
  clearBtn.style.display = query ? "block" : "none";

  // Clear previous timeout
  clearTimeout(searchTimeout);

  if (query.length < 2) {
    searchDropdown.style.display = "none";
    return;
  }

  // Debounce search
  searchTimeout = setTimeout(() => {
    searchProducts(query);
  }, 300);
}

// Search for products
async function searchProducts(query) {
  console.log("Searching for:", query);
  try {
    const response = await fetch("http://localhost:3000/api/search-product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error("Search failed");
    }

    const data = await response.json();
    console.log("Search results:", data);

    if (data.success && data.products && data.products.length > 0) {
      displaySearchDropdown(data.products);
    } else {
      displayNoResults();
    }
  } catch (error) {
    console.error("Search error:", error);
    displayNoResults();
  }
}

// Display search results dropdown
function displaySearchDropdown(products) {
  searchDropdown.innerHTML = "";

  products.forEach((product) => {
    const item = document.createElement("div");
    item.className = "dropdown-item";

    item.innerHTML = `
      <div class="dropdown-item-name">${escapeHtml(product.name)}</div>
    `;

    item.addEventListener("click", () => {
      console.log("Dropdown item clicked:", product);
      selectProduct(product);
    });

    searchDropdown.appendChild(item);
  });

  searchDropdown.style.display = "block";
}

// Display no results message
function displayNoResults() {
  searchDropdown.innerHTML =
    '<div class="dropdown-no-results">No products found</div>';
  searchDropdown.style.display = "block";
}

// Select a product from dropdown
function selectProduct(product) {
  console.log("selectProduct called with:", product);
  selectedProduct = product;
  searchInput.value = product.name;
  searchDropdown.style.display = "none";

  // Load alternatives for this product
  loadAlternatives(product);
}

// Load alternatives for selected product
async function loadAlternatives(product) {
  console.log("loadAlternatives called with product:", product);
  console.log("Current userLocation:", userLocation);

  // Hide empty state, show product results
  emptyState.style.display = "none";
  productResults.style.display = "block";
  productName.textContent = product.name;

  // Show loading
  alternativesList.innerHTML =
    '<div class="loading">Loading alternatives...</div>';

  try {
    const payload = {
      productId: product.id,
      productName: product.name,
      location: userLocation,
    };
    console.log("Sending payload to API:", payload);

    const response = await fetch("http://localhost:3000/api/get-alternatives", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error("Failed to load alternatives");
    }

    const data = await response.json();

    console.log("Alternatives response:", data);
    console.log("User location sent:", userLocation);

    if (data.success && data.alternatives && data.alternatives.length > 0) {
      displayAlternatives(data.alternatives);
    } else {
      alternativesList.innerHTML =
        '<div class="empty-state"><p>No prices available</p></div>';
    }
  } catch (error) {
    console.error("Error loading alternatives:", error);
    alternativesList.innerHTML =
      '<div class="empty-state"><p>Failed to load alternatives</p></div>';
  }
}

// Display alternatives list
function displayAlternatives(alternatives) {
  alternativesList.innerHTML = "";

  alternatives.forEach((alt) => {
    const item = document.createElement("div");
    item.className = "alternative-item";

    const total = alt.total || alt.price;
    const currency = getCurrencySymbol(alt.currency);
    const shippingBadge = getShippingBadge(alt.shipping_type);

    item.innerHTML = `
      <div class="alternative-left">
        <div class="alternative-store">${escapeHtml(alt.store_name)}</div>
        <div class="alternative-details">
          ${shippingBadge}
        </div>
      </div>
      <div class="alternative-right">
        <div class="alternative-price">
          ${currency}${parseFloat(total).toFixed(2)}
          <span class="alternative-currency">${alt.currency}</span>
        </div>
      </div>
    `;

    alternativesList.appendChild(item);
  });
}

// Handle clear button
function handleClear() {
  searchInput.value = "";
  clearBtn.style.display = "none";
  searchDropdown.style.display = "none";
  selectedProduct = null;

  // Reset to empty state
  emptyState.style.display = "block";
  productResults.style.display = "none";
}

// Helper: Get currency symbol
function getCurrencySymbol(currency) {
  const symbols = {
    USD: "$",
    EUR: "€",
    ILS: "₪",
    GBP: "£",
  };
  return symbols[currency] || currency;
}

// Helper: Get shipping badge HTML
function getShippingBadge(type) {
  if (!type) return "";

  const badges = {
    international: "🌍 International",
    local: "📦 Local",
    instore: "🏪 In-store",
    fast: "⚡ Fast delivery",
  };

  const text = badges[type] || type;
  return `<span class="alternative-shipping">${text}</span>`;
}

// Helper: Escape HTML
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Location Modal Functions
function openLocationModal() {
  locationModal.style.display = "block";
  locationSearch.value = userLocation
    ? `${userLocation.city}, ${userLocation.country}`
    : "";
  tempSelectedLocation = userLocation ? { ...userLocation } : null;

  if (tempSelectedLocation) {
    showSelectedLocation(tempSelectedLocation);
  }
}

function closeLocationModal() {
  locationModal.style.display = "none";
  locationSearch.value = "";
  locationSuggestions.style.display = "none";
  locationError.style.display = "none";
  selectedLocationDisplay.style.display = "none";
  tempSelectedLocation = null;
}

function handleLocationSearch(e) {
  const query = e.target.value.trim();

  // Clear previous timeout
  if (locationSearchTimeout) {
    clearTimeout(locationSearchTimeout);
  }

  if (query.length < 3) {
    locationSuggestions.style.display = "none";
    locationError.style.display = "none";
    return;
  }

  // Debounce the search
  locationSearchTimeout = setTimeout(() => {
    searchLocationAddress(query);
  }, 300);
}

async function searchLocationAddress(query) {
  locationError.style.display = "none";

  try {
    const response = await fetch(
      `http://localhost:3000/api/geocode?q=${encodeURIComponent(query)}`
    );

    if (response.status === 429) {
      const data = await response.json();
      showLocationError(
        data.message || "Rate limit exceeded. Please try again later."
      );
      return;
    }

    if (!response.ok) {
      throw new Error("Failed to fetch location suggestions");
    }

    const data = await response.json();
    displayLocationSuggestions(data.features || []);
  } catch (error) {
    console.error("Error fetching location suggestions:", error);
    showLocationError(
      "Failed to fetch location suggestions. Please try again."
    );
  }
}

function displayLocationSuggestions(suggestions) {
  if (suggestions.length === 0) {
    locationSuggestions.style.display = "none";
    return;
  }

  locationSuggestions.innerHTML = "";

  suggestions.forEach((suggestion) => {
    const item = document.createElement("div");
    item.className = "location-suggestion-item";
    item.textContent = suggestion.place_name;

    item.addEventListener("click", () => {
      selectLocationSuggestion(suggestion);
    });

    locationSuggestions.appendChild(item);
  });

  locationSuggestions.style.display = "block";
}

function selectLocationSuggestion(suggestion) {
  const [longitude, latitude] = suggestion.center;
  const parts = suggestion.place_name.split(", ");
  const city = parts[0];
  const country = parts[parts.length - 1];

  tempSelectedLocation = {
    country,
    city,
    latitude,
    longitude,
  };

  locationSearch.value = suggestion.place_name;
  locationSuggestions.style.display = "none";
  showSelectedLocation(tempSelectedLocation);
  saveLocationBtn.disabled = false;
}

function showSelectedLocation(location) {
  selectedLocationText.textContent = `${location.city}, ${location.country}`;
  selectedLocationDisplay.style.display = "block";
  saveLocationBtn.disabled = false;
}

function showLocationError(message) {
  locationError.textContent = message;
  locationError.style.display = "block";
  locationSuggestions.style.display = "none";
}

async function saveLocation() {
  if (!tempSelectedLocation) return;

  userLocation = { ...tempSelectedLocation };
  console.log("Saving location to storage:", userLocation);

  // Save to chrome.storage
  try {
    await chrome.storage.local.set({ userLocation });
    console.log("Location saved successfully");
  } catch (error) {
    console.error("Error saving location to storage:", error);
  }

  updateLocationDisplay();
  closeLocationModal();

  // If there's a selected product, reload alternatives with new location
  if (selectedProduct) {
    loadAlternatives(selectedProduct);
  }
}
