// DOM Elements
const searchInput = document.getElementById("search-input");
const clearBtn = document.getElementById("clear-btn");
const searchDropdown = document.getElementById("search-dropdown");
const emptyState = document.getElementById("empty-state");
const productResults = document.getElementById("product-results");
const productName = document.getElementById("product-name");
const alternativesList = document.getElementById("alternatives-list");
const priceCount = document.getElementById("price-count");
const locationText = document.getElementById("location-text");
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
const capturePriceBtn = document.getElementById("capture-price-btn");

// Filter DOM Elements
const locationFilterBtn = document.getElementById("location-filter-btn");
const locationFilterMenu = document.getElementById("location-filter-menu");
const locationFilterOptions = document.getElementById("location-filter-options");
const locationFilterSearch = document.getElementById("location-filter-search");
const fulfillmentFilterBtn = document.getElementById("fulfillment-filter-btn");
const fulfillmentFilterMenu = document.getElementById("fulfillment-filter-menu");
const fulfillmentFilterOptions = document.getElementById("fulfillment-filter-options");

console.log("Popup script loaded");

// State
let searchTimeout;
let locationSearchTimeout;
let selectedProduct = null;
let userLocation = null;
let tempSelectedLocation = null;
let allAlternatives = [];

// Filter State
let selectedLocations = []; // Array of selected location keys
let selectedFulfillment = ""; // Empty = all types

// Load saved search state
function loadSavedSearch() {
  try {
    const savedState = localStorage.getItem("lastSearch");
    if (savedState) {
      const { product, alternatives, query } = JSON.parse(savedState);
      if (product && alternatives) {
        selectedProduct = product;
        allAlternatives = alternatives;
        searchInput.value = query || product.name;

        // Display the saved results
        emptyState.style.display = "none";
        productResults.style.display = "block";
        productName.textContent = product.name;
        displayAlternatives(alternatives);
      }
    }
  } catch (error) {
    console.error("Error loading saved search:", error);
  }
}

// Save search state to localStorage
function saveSearchState() {
  if (selectedProduct && allAlternatives.length > 0) {
    try {
      const state = {
        product: selectedProduct,
        alternatives: allAlternatives,
        query: searchInput.value,
      };
      localStorage.setItem("lastSearch", JSON.stringify(state));
    } catch (error) {
      console.error("Error saving search state:", error);
    }
  }
}

// Initialize
initLocation();
loadSavedSearch();
searchInput.addEventListener("input", handleSearchInput);
clearBtn.addEventListener("click", handleClear);
editLocationBtn.addEventListener("click", openLocationModal);
closeModalBtn.addEventListener("click", closeLocationModal);
cancelLocationBtn.addEventListener("click", closeLocationModal);
locationSearch.addEventListener("input", handleLocationSearch);
saveLocationBtn.addEventListener("click", saveLocation);
capturePriceBtn.addEventListener("click", startPriceCapture);

// Filter event listeners
locationFilterBtn.addEventListener("click", toggleLocationFilter);
fulfillmentFilterBtn.addEventListener("click", toggleFulfillmentFilter);
locationFilterSearch.addEventListener("input", handleLocationFilterSearch);
fulfillmentFilterOptions.addEventListener("click", handleFulfillmentOptionClick);

// Close filter menus when clicking outside
document.addEventListener("click", (e) => {
  if (!e.target.closest("#location-filter-dropdown")) {
    locationFilterMenu.style.display = "none";
  }
  if (!e.target.closest("#fulfillment-filter-dropdown")) {
    fulfillmentFilterMenu.style.display = "none";
  }
});

// Initialize location
async function initLocation() {
  console.log("initLocation called");
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
    const location =
      userLocation.fullAddress ||
      (userLocation.city
        ? `${userLocation.city}, ${userLocation.country}`
        : userLocation.country);
    locationText.textContent = location;
  }
}

// Close dropdown when clicking outside
document.addEventListener("click", (e) => {
  if (!searchDropdown.contains(e.target) && e.target !== searchInput) {
    searchDropdown.style.display = "none";
  }
});

// Close modal when clicking outside modal content
locationModal?.addEventListener("click", (e) => {
  if (e.target === locationModal) {
    closeLocationModal();
  }
});

// Handle search input
function handleSearchInput(e) {
  const query = e.target.value.trim();

  clearBtn.style.display = query ? "block" : "none";

  clearTimeout(searchTimeout);

  if (query.length < 2) {
    searchDropdown.style.display = "none";
    return;
  }

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

    item.innerHTML = `<div class="dropdown-item-name">${escapeHtml(
      product.name
    )}</div>`;

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

  // Reset filters when selecting a new product
  resetFilters();

  loadAlternatives(product);
  saveSearchState();
}

// Load alternatives for selected product
async function loadAlternatives(product) {
  console.log("loadAlternatives called with product:", product);
  console.log("Current userLocation:", userLocation);

  emptyState.style.display = "none";
  productResults.style.display = "block";
  productName.textContent = product.name;

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

    if (data.success && data.alternatives && data.alternatives.length > 0) {
      allAlternatives = data.alternatives;
      displayAlternatives(allAlternatives);
      saveSearchState();
    } else {
      allAlternatives = [];
      alternativesList.innerHTML =
        '<div class="empty-state"><p>No prices available</p></div>';
    }
  } catch (error) {
    console.error("Error loading alternatives:", error);
    allAlternatives = [];
    alternativesList.innerHTML =
      '<div class="empty-state"><p>Failed to load alternatives</p></div>';
  }
}

// Display alternatives list (matching web app format)
function displayAlternatives(alternatives) {
  // Sort alternatives by price (lowest to highest)
  const sorted = [...alternatives].sort((a, b) => {
    const aPrice = a.total || a.price || 0;
    const bPrice = b.total || b.price || 0;
    return aPrice - bPrice;
  });

  // Update price count - show filtered/total if filters are active
  if (priceCount) {
    const hasFilters = selectedLocations.length > 0 || selectedFulfillment;
    if (hasFilters) {
      priceCount.textContent = `${sorted.length}/${allAlternatives.length}`;
    } else {
      priceCount.textContent = sorted.length;
    }
  }

  if (sorted.length === 0) {
    alternativesList.innerHTML = `
      <div class="no-results-message none">
        <div class="no-results-content">
          <span class="no-results-icon">📍</span>
          <div>
            <div class="no-results-title">No suppliers available for your location</div>
            <div class="no-results-text">This product is not currently available from stores that can serve your area.</div>
          </div>
        </div>
      </div>
    `;
    return;
  }

  alternativesList.innerHTML = "";

  sorted.forEach((alt) => {
    const row = document.createElement("div");
    row.className = "price-row";

    const total = alt.total || alt.price;
    const currency = alt.currency || "USD";
    const storeName = alt.store_name || "Unknown Store";

    // Format fulfillment type (matching web app)
    let fulfillmentLabel = "delivery";
    if (alt.shipping_type === "in_store_only") {
      fulfillmentLabel = "store";
    } else if (alt.fulfillment_type === "person") {
      fulfillmentLabel = "person-used";
    }

    // Format price type
    const priceTypeLabel = alt.is_final_price !== false ? "final price" : "non-final price";

    // Format price display
    const priceDisplay = `${getCurrencySymbol(currency)}${parseFloat(total).toFixed(2)}`;

    // Build the left side: "$X.XX / Store / fulfillment / price type"
    const priceInfoText = `${priceDisplay} / ${escapeHtml(storeName)} / ${fulfillmentLabel} / ${priceTypeLabel}`;

    // Build the right side: "Captured from Location • Time ago"
    const location = alt.captured_by_city
      ? `${alt.captured_by_city}, ${alt.captured_by_country}`
      : (alt.captured_by_country || "Unknown");
    const timeAgo = alt.created_at ? formatTimeAgo(alt.created_at) : "";
    const metaText = `Captured from ${escapeHtml(location)}${timeAgo ? ` • ${timeAgo}` : ""}`;

    // Create the row HTML
    if (alt.source_url) {
      row.innerHTML = `
        <div class="price-info">
          <a href="${alt.source_url}" target="_blank" rel="noopener noreferrer">${priceInfoText}</a>
        </div>
        <div class="price-meta">${metaText}</div>
      `;
    } else {
      row.innerHTML = `
        <div class="price-info">${priceInfoText}</div>
        <div class="price-meta">${metaText}</div>
      `;
    }

    alternativesList.appendChild(row);
  });
}

// Helper: Format time ago
function formatTimeAgo(dateString) {
  const now = new Date();
  const past = new Date(dateString);
  const diffInMs = now.getTime() - past.getTime();

  const hours = Math.floor(diffInMs / (1000 * 60 * 60));
  const days = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (hours < 24) {
    return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  }
  return `${days} day${days !== 1 ? "s" : ""} ago`;
}

// Handle clear button
function handleClear() {
  searchInput.value = "";
  clearBtn.style.display = "none";
  searchDropdown.style.display = "none";
  selectedProduct = null;
  allAlternatives = [];

  // Clear saved search state
  localStorage.removeItem("lastSearch");

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
  return symbols[currency] || "$";
}

// Helper: Escape HTML
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ==================== FILTER FUNCTIONS ====================

// Toggle location filter dropdown
function toggleLocationFilter(e) {
  e.stopPropagation();
  const isOpen = locationFilterMenu.style.display === "block";
  locationFilterMenu.style.display = isOpen ? "none" : "block";
  fulfillmentFilterMenu.style.display = "none";

  if (!isOpen) {
    locationFilterSearch.value = "";
    populateLocationFilterOptions();
  }
}

// Toggle fulfillment filter dropdown
function toggleFulfillmentFilter(e) {
  e.stopPropagation();
  const isOpen = fulfillmentFilterMenu.style.display === "block";
  fulfillmentFilterMenu.style.display = isOpen ? "none" : "block";
  locationFilterMenu.style.display = "none";

  if (!isOpen) {
    updateFulfillmentFilterUI();
  }
}

// Populate location filter options based on available alternatives
function populateLocationFilterOptions(searchQuery = "") {
  // Extract unique locations from alternatives
  const locationsByCountry = {};

  allAlternatives.forEach((alt) => {
    const country = alt.captured_by_country || "Unknown";
    const city = alt.captured_by_city;

    if (!locationsByCountry[country]) {
      locationsByCountry[country] = new Set();
    }
    if (city) {
      locationsByCountry[country].add(city);
    }
  });

  const countries = Object.keys(locationsByCountry).sort();
  const query = searchQuery.toLowerCase();

  let html = `
    <div class="filter-option ${selectedLocations.length === 0 ? 'selected' : ''}" data-value="">
      <span>Worldwide</span>
      <svg class="filter-check" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
      </svg>
    </div>
  `;

  countries.forEach((country) => {
    // Filter by search query
    const cities = Array.from(locationsByCountry[country]).sort();
    const countryMatches = !query || country.toLowerCase().includes(query);
    const matchingCities = cities.filter(city => !query || city.toLowerCase().includes(query) || countryMatches);

    if (!countryMatches && matchingCities.length === 0) return;

    const isCountrySelected = selectedLocations.includes(country);

    html += `
      <div class="filter-option country ${isCountrySelected ? 'selected' : ''}" data-value="${escapeHtml(country)}" data-type="country">
        <span>${escapeHtml(country)}</span>
        <svg class="filter-check" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
        </svg>
      </div>
    `;

    // Add cities under each country
    (countryMatches ? cities : matchingCities).forEach((city) => {
      const cityKey = `${country}:${city}`;
      const isCitySelected = selectedLocations.includes(cityKey);

      html += `
        <div class="filter-option city ${isCitySelected ? 'selected' : ''}" data-value="${escapeHtml(cityKey)}" data-type="city">
          <span>${escapeHtml(city)}</span>
          <svg class="filter-check" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
          </svg>
        </div>
      `;
    });
  });

  locationFilterOptions.innerHTML = html;

  // Add click handlers
  locationFilterOptions.querySelectorAll(".filter-option").forEach((option) => {
    option.addEventListener("click", handleLocationOptionClick);
  });
}

// Handle location option click
function handleLocationOptionClick(e) {
  const option = e.currentTarget;
  const value = option.dataset.value;

  if (value === "") {
    // "Worldwide" selected - clear all selections
    selectedLocations = [];
  } else {
    // Toggle selection
    const index = selectedLocations.indexOf(value);
    if (index > -1) {
      selectedLocations.splice(index, 1);
    } else {
      selectedLocations.push(value);
    }
  }

  updateLocationFilterUI();
  applyFilters();
}

// Handle location filter search input
function handleLocationFilterSearch(e) {
  const query = e.target.value.trim();
  populateLocationFilterOptions(query);
}

// Update location filter button text
function updateLocationFilterUI() {
  let buttonText = "📍 Worldwide";

  if (selectedLocations.length === 1) {
    const loc = selectedLocations[0];
    // If it's a city (contains colon), show just the city name
    if (loc.includes(":")) {
      buttonText = "📍 " + loc.split(":")[1];
    } else {
      buttonText = "📍 " + loc;
    }
  } else if (selectedLocations.length > 1) {
    buttonText = `📍 ${selectedLocations.length} locations`;
  }

  locationFilterBtn.querySelector("span").textContent = buttonText;
  populateLocationFilterOptions(locationFilterSearch.value);
}

// Handle fulfillment option click
function handleFulfillmentOptionClick(e) {
  const option = e.target.closest(".filter-option");
  if (!option) return;

  selectedFulfillment = option.dataset.value;
  updateFulfillmentFilterUI();
  fulfillmentFilterMenu.style.display = "none";
  applyFilters();
}

// Update fulfillment filter UI
function updateFulfillmentFilterUI() {
  let buttonText = "All types";
  if (selectedFulfillment === "delivery") buttonText = "Delivery";
  else if (selectedFulfillment === "store") buttonText = "Store";
  else if (selectedFulfillment === "person") buttonText = "Person";

  fulfillmentFilterBtn.querySelector("span").textContent = buttonText;

  // Update selected state in menu
  fulfillmentFilterOptions.querySelectorAll(".filter-option").forEach((option) => {
    if (option.dataset.value === selectedFulfillment) {
      option.classList.add("selected");
    } else {
      option.classList.remove("selected");
    }
  });
}

// Apply filters and re-display alternatives
function applyFilters() {
  const filtered = allAlternatives.filter((alt) => {
    // Location filter
    let locationMatch = selectedLocations.length === 0;
    if (!locationMatch) {
      const country = alt.captured_by_country || "";
      const city = alt.captured_by_city;

      // Check if country is selected
      if (selectedLocations.includes(country)) {
        locationMatch = true;
      }
      // Check if specific city is selected
      else if (city) {
        const cityKey = `${country}:${city}`;
        locationMatch = selectedLocations.includes(cityKey);
      }
    }

    // Fulfillment filter
    let fulfillmentMatch = !selectedFulfillment;
    if (!fulfillmentMatch) {
      const altFulfillment = alt.fulfillment_type || (alt.shipping_type === "in_store_only" ? "store" : "delivery");
      fulfillmentMatch = altFulfillment === selectedFulfillment;
    }

    return locationMatch && fulfillmentMatch;
  });

  displayAlternatives(filtered);
}

// Reset filters (call when loading new product)
function resetFilters() {
  selectedLocations = [];
  selectedFulfillment = "";
  updateLocationFilterUI();
  updateFulfillmentFilterUI();
}

// ==================== END FILTER FUNCTIONS ====================

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

  if (locationSearchTimeout) {
    clearTimeout(locationSearchTimeout);
  }

  if (query.length < 3) {
    locationSuggestions.style.display = "none";
    locationError.style.display = "none";
    return;
  }

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

  locationSearch.value = suggestion.place_name;
  locationSuggestions.style.display = "none";
  showSelectedLocation(tempSelectedLocation);
  saveLocationBtn.disabled = false;
}

function showSelectedLocation(location) {
  selectedLocationText.textContent =
    location.fullAddress || `${location.city}, ${location.country}`;
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

  try {
    await chrome.storage.local.set({ userLocation });
    console.log("Location saved successfully");
  } catch (error) {
    console.error("Error saving location to storage:", error);
  }

  updateLocationDisplay();
  closeLocationModal();

  if (selectedProduct) {
    loadAlternatives(selectedProduct);
  }
}

// Start price capture
async function startPriceCapture() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    // Check both chrome.storage.local and localStorage for existing data
    const result = await chrome.storage.local.get(["priceCommonsCaptureForm"]);
    const savedData = result.priceCommonsCaptureForm;

    // Check if we have a selected product in localStorage
    let productData = null;
    try {
      const savedState = localStorage.getItem("lastSearch");
      if (savedState) {
        const { product } = JSON.parse(savedState);
        if (product) {
          productData = product;
        }
      }
    } catch (error) {
      console.error("Error reading product from localStorage:", error);
    }

    // If we have either saved form data OR a selected product, open modal with that data
    if (savedData || productData) {
      // Sync the product data to chrome.storage.local if we have it
      if (productData && !savedData) {
        await chrome.storage.local.set({
          priceCommonsCaptureForm: {
            productName: productData.name,
            productId: productData.id,
          },
        });
      }

      // Open modal directly with existing data
      await chrome.tabs.sendMessage(tab.id, {
        action: "openPriceModal",
        productData: productData,
      });
    } else {
      // Otherwise, start fresh price capture
      await chrome.tabs.sendMessage(tab.id, { action: "startPriceCapture" });
    }

    // Close the popup
    window.close();
  } catch (error) {
    console.error("Error starting price capture:", error);
    alert("Failed to start price capture. Please try again.");
  }
}
