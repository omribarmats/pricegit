"use client";

import { useState, useEffect, useRef } from "react";
import { Product, UserLocation } from "@/types";
import { LocationModal } from "@/components/LocationModal";
import PriceBreakdownTooltip from "@/components/PriceBreakdownTooltip";
import PriceReviewModal from "@/components/PriceReviewModal";
import { canStoreServeUser } from "@/lib/storeFilters";
import {
  getUserLocationFromIP,
  getStoredLocation,
  setStoredLocation,
} from "@/lib/location";
import { getCurrencySymbol } from "@/lib/currency";
import { calculateDistance } from "@/lib/distance";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  checkExtensionInstalled,
  openTabWithInstructionPopup,
} from "@/lib/extension";
import Link from "next/link";

interface ProductDetailClientProps {
  product: Product;
  currentUserId?: string;
}

interface LatestPrice {
  id: string; // Add price history ID for unique keys
  source: string;
  price: number;
  base_price?: number | null;
  shipping_cost?: number | null;
  fees?: number | null;
  source_url: string;
  created_at: string;
  store_id: string;
  captured_by_country: string;
  captured_by_city: string | null;
  fulfillment_type: "delivery" | "store" | "person";
  condition: "new" | "used";
  product_type: "physical" | "digital";
  currency?: string;
  is_final_price?: boolean;
  status?: "pending" | "approved" | "rejected";
  submitted_by?: string;
  screenshot_url?: string | null;
  stores?: Product["price_history"][0]["stores"];
  submitted_by_username?: string;
}

interface PriceGroup {
  key: string;
  latest: LatestPrice;
  history: LatestPrice[];
}

function formatTimeAgo(date: string): string {
  const now = new Date();
  const past = new Date(date);
  const diffInMs = now.getTime() - past.getTime();

  const hours = Math.floor(diffInMs / (1000 * 60 * 60));
  const days = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (hours < 24) {
    return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  }
  return `${days} day${days !== 1 ? "s" : ""} ago`;
}

function PriceDisplay({
  price,
  currency,
}: {
  price: number;
  currency: string;
}) {
  const currencySymbol = getCurrencySymbol(currency);

  return (
    <span>
      {currencySymbol}
      {price.toFixed(2)}
    </span>
  );
}

function mapHistoryToLatestPrice(
  history: Product["price_history"][0],
): LatestPrice {
  const submittedByUser = history.submitted_by_user;
  const username = Array.isArray(submittedByUser)
    ? submittedByUser[0]?.username
    : submittedByUser?.username;

  return {
    id: history.id,
    source: history.source,
    price: history.price,
    base_price: history.base_price,
    shipping_cost: history.shipping_cost,
    fees: history.fees,
    source_url: history.source_url || "",
    created_at: history.created_at,
    store_id: history.store_id,
    captured_by_country: history.captured_by_country,
    captured_by_city: history.captured_by_city ?? null,
    fulfillment_type: history.fulfillment_type,
    condition: history.condition,
    product_type: history.product_type,
    currency: history.currency,
    is_final_price: history.is_final_price,
    status: history.status,
    submitted_by: history.submitted_by,
    screenshot_url: history.screenshot_url,
    stores: history.stores,
    submitted_by_username: username,
  };
}

function groupPricesByStoreLocation(
  priceHistory: Product["price_history"],
): PriceGroup[] {
  const groupMap = new Map<string, LatestPrice[]>();
  const aliasMap = new Map<string, string>();

  priceHistory.forEach((history) => {
    const storeName = Array.isArray(history.stores)
      ? history.stores[0]?.name
      : history.stores?.name;
    const normalizedStoreName = storeName?.toLowerCase().trim();
    const storeId = history.store_id || "";
    const locationSuffix = history.captured_by_city
      ? `${history.captured_by_country}:${history.captured_by_city}`
      : `${history.captured_by_country}`;

    const idKey = storeId ? `id:${storeId}:${locationSuffix}` : null;
    const nameKey = normalizedStoreName
      ? `name:${normalizedStoreName}:${locationSuffix}`
      : history.source
        ? `source:${history.source.toLowerCase().trim()}:${locationSuffix}`
        : null;

    const existingKey =
      (idKey && aliasMap.get(idKey)) ||
      (nameKey && aliasMap.get(nameKey)) ||
      idKey ||
      nameKey ||
      `unknown:${locationSuffix}`;

    if (idKey) aliasMap.set(idKey, existingKey);
    if (nameKey) aliasMap.set(nameKey, existingKey);

    const entry = mapHistoryToLatestPrice(history);
    const group = groupMap.get(existingKey);
    if (group) {
      group.push(entry);
    } else {
      groupMap.set(existingKey, [entry]);
    }
  });

  return Array.from(groupMap.entries()).map(([key, entries]) => {
    const sorted = entries.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    return {
      key,
      latest: sorted[0],
      history: sorted.slice(1),
    };
  });
}

function getLatestPricePerStore(
  priceHistory: Product["price_history"],
): LatestPrice[] {
  return groupPricesByStoreLocation(priceHistory).map((group) => group.latest);
}

function sortPricesByRelevance(
  prices: LatestPrice[],
  userCountry: string | null,
  userCity: string | null,
): LatestPrice[] {
  return prices.sort((a, b) => {
    // Assign tier based on location, fulfillment, and condition
    const getTier = (price: LatestPrice): number => {
      const isSameCity =
        userCity &&
        userCountry &&
        price.captured_by_city === userCity &&
        price.captured_by_country === userCountry;
      const isSameCountry =
        userCountry && price.captured_by_country === userCountry;
      const isDelivery = price.fulfillment_type === "delivery";
      const isStore = price.fulfillment_type === "store";
      const isNew = price.condition === "new";

      // User's city + delivery + new
      if (isSameCity && isDelivery && isNew) return 1;
      // User's country (other cities) + delivery + new
      if (isSameCountry && !isSameCity && isDelivery && isNew) return 2;
      // User's city + store + new
      if (isSameCity && isStore && isNew) return 3;
      // User's city + delivery + used
      if (isSameCity && isDelivery && !isNew) return 4;
      // User's city + store + used
      if (isSameCity && isStore && !isNew) return 5;
      // User's country (other cities) + store + new
      if (isSameCountry && !isSameCity && isStore && isNew) return 6;
      // User's country (other cities) + delivery + used
      if (isSameCountry && !isSameCity && isDelivery && !isNew) return 7;
      // User's country (other cities) + store + used
      if (isSameCountry && !isSameCity && isStore && !isNew) return 8;
      // Everything else (other countries) - sort by fulfillment, condition, price
      if (isDelivery && isNew) return 9;
      if (isDelivery && !isNew) return 10;
      if (isStore && isNew) return 11;
      if (isStore && !isNew) return 12;
      return 13; // person fulfillment or other
    };

    const tierA = getTier(a);
    const tierB = getTier(b);

    // Sort by tier first
    if (tierA !== tierB) {
      return tierA - tierB;
    }

    // Within same tier, sort by price (ascending)
    return a.price - b.price;
  });
}

export function ProductDetailClient({
  product,
  currentUserId,
}: ProductDetailClientProps) {
  const { user, userProfile } = useAuth();
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [isStarred, setIsStarred] = useState(false);
  const [isStarring, setIsStarring] = useState(false);
  const [activeTab, setActiveTab] = useState<"prices" | "pending">("prices");
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [rejectionReason, setRejectionReason] = useState("");
  const [pendingPricesState, setPendingPricesState] = useState<
    typeof product.price_history
  >([]);
  const [showReviewModal, setShowReviewModal] = useState<string | null>(null);
  const [showNonModeratorModal, setShowNonModeratorModal] = useState(false);
  const [extensionInstalled, setExtensionInstalled] = useState<boolean | null>(
    null,
  );
  const [revalidatingId, setRevalidatingId] = useState<string | null>(null);
  const [showExtensionInstallModal, setShowExtensionInstallModal] =
    useState(false);

  // No filtering needed, use product directly
  const filteredProduct = product;

  // Filter states
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedFulfillments, setSelectedFulfillments] = useState<string[]>(
    [],
  );
  const [locationDropdownOpen, setLocationDropdownOpen] = useState(false);
  const [fulfillmentDropdownOpen, setFulfillmentDropdownOpen] = useState(false);
  const [locationSearchQuery, setLocationSearchQuery] = useState("");
  const locationDropdownRef = useRef<HTMLDivElement>(null);
  const fulfillmentDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch pending prices client-side (server can't access user session)
  useEffect(() => {
    const fetchPendingPrices = async () => {
      if (!user) {
        setPendingPricesState([]);
        return;
      }

      const { data, error } = await supabase
        .from("price_history")
        .select(
          `
          id,
          price,
          base_price,
          shipping_cost,
          fees,
          source,
          source_url,
          created_at,
          store_id,
          captured_by_country,
          captured_by_city,
          fulfillment_type,
          condition,
          product_type,
          currency,
          is_final_price,
          status,
          submitted_by,
          screenshot_url,
          stores (
            id,
            name,
            country,
            city,
            created_at
          ),
          submitted_by_user:users!submitted_by (username)
        `,
        )
        .eq("product_id", product.id)
        .eq("status", "pending");

      if (error) {
        console.error("Error fetching pending prices:", error);
      }

      if (!error && data) {
        setPendingPricesState(data as typeof product.price_history);
      }
    };

    fetchPendingPrices();
  }, [product.id, user]);

  useEffect(() => {
    const initializeLocation = async () => {
      const stored = getStoredLocation();
      if (stored) {
        setUserLocation(stored);
        setIsLoadingLocation(false);
        return;
      }

      const ipLocation = await getUserLocationFromIP();
      if (ipLocation) {
        setUserLocation(ipLocation);
        setStoredLocation(ipLocation);
      } else {
        setIsLocationModalOpen(true);
      }
      setIsLoadingLocation(false);
    };

    initializeLocation();
  }, []);

  // Check if extension is installed
  useEffect(() => {
    checkExtensionInstalled().then(setExtensionInstalled);
  }, []);

  const handleRecapture = async (sourceUrl: string, priceId: string) => {
    // Check if extension is installed
    if (extensionInstalled === false) {
      // Show install prompt
      setShowExtensionInstallModal(true);
      return;
    }

    // Request extension to open tab with instruction popup
    const success = await openTabWithInstructionPopup(sourceUrl);

    if (!success) {
      console.error("Failed to communicate with extension");
      alert(
        "Failed to open tab. Please make sure the extension is installed and try again.",
      );
    }
  };

  const handleInstallExtension = () => {
    window.open("https://chrome.google.com/webstore", "_blank");
    setShowExtensionInstallModal(false);
  };

  // Check if product is starred by current user
  useEffect(() => {
    const checkIfStarred = async () => {
      if (!user) {
        setIsStarred(false);
        return;
      }

      const { data } = await supabase
        .from("starred_products")
        .select("id")
        .eq("user_id", user.id)
        .eq("product_id", product.id)
        .single();

      setIsStarred(!!data);
    };

    checkIfStarred();
  }, [user, product.id]);

  const handleApprove = async (priceId: string) => {
    setReviewingId(priceId);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        alert("Please log in to review prices");
        return;
      }

      const response = await fetch("/api/prices/review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          priceId,
          action: "approve",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("Approval failed:", result);
        alert(
          result.error +
            (result.details ? `\n${result.details}` : "") +
            (result.code ? `\nCode: ${result.code}` : ""),
        );
        return;
      }

      // Remove from pending list
      setPendingPricesState((prev) => prev.filter((p) => p.id !== priceId));
      alert("Price approved successfully!");
    } catch (err) {
      console.error("Error approving price:", err);
      alert("Failed to approve price");
    } finally {
      setReviewingId(null);
    }
  };

  const handleReject = async (priceId: string, reason: string) => {
    if (!reason.trim()) {
      alert("Please provide a reason for rejection");
      return;
    }

    setReviewingId(priceId);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        alert("Please log in to review prices");
        return;
      }

      const response = await fetch("/api/prices/review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          priceId,
          action: "reject",
          rejectionReason: reason.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("Rejection failed:", result);
        alert(
          result.error +
            (result.details ? `\n${result.details}` : "") +
            (result.code ? `\nCode: ${result.code}` : ""),
        );
        return;
      }

      // Remove from pending list
      setPendingPricesState((prev) => prev.filter((p) => p.id !== priceId));
      setShowReviewModal(null);
      alert("Price rejected");
    } catch (err) {
      console.error("Error rejecting price:", err);
      alert("Failed to reject price");
    } finally {
      setReviewingId(null);
    }
  };

  const toggleStar = async () => {
    if (!user) {
      // Redirect to login if not authenticated
      window.location.href = "/login";
      return;
    }

    setIsStarring(true);

    if (isStarred) {
      // Remove star
      await supabase
        .from("starred_products")
        .delete()
        .eq("user_id", user.id)
        .eq("product_id", product.id);
      setIsStarred(false);
    } else {
      // Add star
      await supabase.from("starred_products").insert({
        user_id: user.id,
        product_id: product.id,
      });
      setIsStarred(true);
    }

    setIsStarring(false);
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        locationDropdownRef.current &&
        !locationDropdownRef.current.contains(event.target as Node)
      ) {
        setLocationDropdownOpen(false);
      }
      if (
        fulfillmentDropdownRef.current &&
        !fulfillmentDropdownRef.current.contains(event.target as Node)
      ) {
        setFulfillmentDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLocationSave = (location: UserLocation) => {
    setUserLocation(location);
    setStoredLocation(location);
  };

  if (isLoadingLocation) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-500">Detecting your location...</div>
      </div>
    );
  }

  // Separate approved and pending prices
  const approvedPrices = (filteredProduct.price_history || []).filter(
    (price) => price.status === "approved",
  );
  // Use state for pending prices so we can update after review
  const pendingPrices = pendingPricesState;

  const allGroups = groupPricesByStoreLocation(approvedPrices);
  const latestPrices = allGroups.map((group) => group.latest);

  // Get unique countries and cities from price history
  const locationsByCountry = (filteredProduct.price_history || []).reduce(
    (acc, capture) => {
      const country = capture.captured_by_country;
      const city = capture.captured_by_city;

      if (!acc[country]) {
        acc[country] = new Set<string>();
      }
      if (city) {
        acc[country].add(city);
      }
      return acc;
    },
    {} as Record<string, Set<string>>,
  );

  const countries = Object.keys(locationsByCountry).sort();

  // Filter prices based on selected filters
  const filteredApprovedPrices = approvedPrices.filter((priceEntry) => {
    // Location filter (country or city level)
    let locationMatch = selectedLocations.length === 0;
    if (!locationMatch) {
      // Check if country is selected
      if (selectedLocations.includes(priceEntry.captured_by_country)) {
        locationMatch = true;
      }
      // Check if specific city is selected
      else if (priceEntry.captured_by_city) {
        const cityKey = `${priceEntry.captured_by_country}:${priceEntry.captured_by_city}`;
        locationMatch = selectedLocations.includes(cityKey);
      }
    }

    // Fulfillment filter
    const fulfillmentMatch =
      selectedFulfillments.length === 0 ||
      selectedFulfillments.includes(priceEntry.fulfillment_type || "");

    return locationMatch && fulfillmentMatch;
  });

  // Determine user's location for sorting (priority: userProfile > userLocation)
  const sortCountry = userProfile?.country || userLocation?.country || null;
  const sortCity = userProfile?.city || userLocation?.city || null;

  // Sort prices by relevance to user
  const filteredGroups = groupPricesByStoreLocation(filteredApprovedPrices);
  const filteredGroupMap = new Map(
    filteredGroups.map((group) => [group.latest.id, group]),
  );
  const sortedGroups = sortPricesByRelevance(
    filteredGroups.map((group) => group.latest),
    sortCountry,
    sortCity,
  )
    .map((latest) => filteredGroupMap.get(latest.id))
    .filter(Boolean) as PriceGroup[];

  const toggleGroupExpanded = (key: string) => {
    setExpandedGroups((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const toggleLocation = (location: string) => {
    setSelectedLocations((prev) =>
      prev.includes(location)
        ? prev.filter((l) => l !== location)
        : [...prev, location],
    );
  };

  const isLocationSelected = (location: string): boolean => {
    return selectedLocations.includes(location);
  };

  const toggleFulfillment = (type: string) => {
    setSelectedFulfillments((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  const getLocationButtonText = () => {
    if (selectedLocations.length === 0) return "Worldwide";
    if (selectedLocations.length === 1) {
      const loc = selectedLocations[0];
      // If it's a city (contains colon), show just the city name
      if (loc.includes(":")) {
        return loc.split(":")[1];
      }
      return loc;
    }
    return `${selectedLocations.length} locations`;
  };

  const getFulfillmentButtonText = () => {
    if (selectedFulfillments.length === 0) return "All types";
    if (selectedFulfillments.length === 1) {
      return selectedFulfillments[0] === "delivery" ? "Delivery" : "Store";
    }
    return `${selectedFulfillments.length} types`;
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Sub-navigation tabs */}
      <div className="bg-[#F5EDF5]/20 border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex gap-8">
            <span className="py-3 text-xs text-gray-900">{product.name}</span>
            <button
              onClick={() => setActiveTab("prices")}
              className={`py-3 text-xs text-gray-900 hover:text-gray-700 transition-colors cursor-pointer ${
                activeTab === "prices"
                  ? "border-b-2 border-blue-600"
                  : "border-b-2 border-transparent"
              }`}
            >
              Prices ({allGroups.length})
            </button>
            <button
              onClick={() => setActiveTab("pending")}
              className={`py-3 text-xs text-gray-900 hover:text-gray-700 transition-colors cursor-pointer ${
                activeTab === "pending"
                  ? "border-b-2 border-blue-600"
                  : "border-b-2 border-transparent"
              }`}
            >
              Pending verification ({pendingPrices.length})
            </button>
          </div>
        </div>
      </div>
      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Product Header */}
        <div className="mb-8 pb-6 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {product.name}
              </h1>
              {activeTab === "prices" && (
                <p className="text-sm text-gray-600 mt-2">
                  Showing {allGroups.length}{" "}
                  {allGroups.length === 1 ? "price" : "prices"} from around the
                  world
                </p>
              )}
            </div>
            <button
              onClick={toggleStar}
              disabled={isStarring}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer"
              title={isStarred ? "Remove from starred" : "Add to starred"}
            >
              {isStarred ? (
                <svg
                  className="w-5 h-5 text-yellow-500 fill-current"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                  />
                </svg>
              )}
              <span className="text-sm text-gray-700">
                {isStarred ? "Starred" : "Star"}
              </span>
            </button>
          </div>
        </div>

        {/* Price Comparison Table */}
        <div className="mb-8">
          {/* Filters */}
          <div className="flex gap-3 mb-4">
            {/* Location Filter Dropdown */}
            <div ref={locationDropdownRef} className="relative">
              <button
                onClick={() => {
                  setLocationDropdownOpen(!locationDropdownOpen);
                  if (!locationDropdownOpen) {
                    setLocationSearchQuery("");
                  }
                }}
                className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2 cursor-pointer"
              >
                <span>📍 {getLocationButtonText()}</span>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {locationDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-80 overflow-hidden flex flex-col">
                  <div className="p-3 border-b border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">
                      Capture Location
                    </h3>
                    <input
                      type="text"
                      placeholder="Search locations..."
                      value={locationSearchQuery}
                      onChange={(e) => setLocationSearchQuery(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="overflow-y-auto">
                    <button
                      onClick={() => {
                        setSelectedLocations([]);
                        setLocationDropdownOpen(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between"
                    >
                      <span className="text-gray-600">worldwide</span>
                      {selectedLocations.length === 0 && (
                        <svg
                          className="w-4 h-4 text-blue-600"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>
                    {countries
                      .filter((country) => {
                        // Filter by search query
                        if (!locationSearchQuery) return true;
                        const query = locationSearchQuery.toLowerCase();
                        // Check if country matches
                        if (country.toLowerCase().includes(query)) return true;
                        // Check if any city matches
                        const cities = Array.from(locationsByCountry[country]);
                        return cities.some((city) =>
                          city.toLowerCase().includes(query),
                        );
                      })
                      .map((country) => {
                        const cities = Array.from(locationsByCountry[country])
                          .filter((city) => {
                            if (!locationSearchQuery) return true;
                            const query = locationSearchQuery.toLowerCase();
                            return (
                              city.toLowerCase().includes(query) ||
                              country.toLowerCase().includes(query)
                            );
                          })
                          .sort();
                        return (
                          <div key={country}>
                            <button
                              onClick={() => toggleLocation(country)}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between"
                            >
                              <span className="font-semibold text-gray-900">
                                {country}
                              </span>
                              {isLocationSelected(country) && (
                                <svg
                                  className="w-4 h-4 text-blue-600"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              )}
                            </button>
                            {cities.map((city) => {
                              const cityKey = `${country}:${city}`;
                              return (
                                <button
                                  key={cityKey}
                                  onClick={() => toggleLocation(cityKey)}
                                  className="w-full pl-8 pr-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between"
                                >
                                  <span className="text-gray-700">{city}</span>
                                  {isLocationSelected(cityKey) && (
                                    <svg
                                      className="w-4 h-4 text-blue-600"
                                      fill="currentColor"
                                      viewBox="0 0 20 20"
                                    >
                                      <path
                                        fillRule="evenodd"
                                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            {/* Fulfillment Type Filter Dropdown */}
            <div ref={fulfillmentDropdownRef} className="relative">
              <button
                onClick={() =>
                  setFulfillmentDropdownOpen(!fulfillmentDropdownOpen)
                }
                className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2 cursor-pointer"
              >
                <span>{getFulfillmentButtonText()}</span>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {fulfillmentDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                  <div className="p-3 border-b border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-900">
                      Fulfillment type
                    </h3>
                  </div>
                  <div>
                    <button
                      onClick={() => {
                        setSelectedFulfillments([]);
                        setFulfillmentDropdownOpen(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between"
                    >
                      <span>All types</span>
                      {selectedFulfillments.length === 0 && (
                        <svg
                          className="w-4 h-4 text-blue-600"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={() => toggleFulfillment("delivery")}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between"
                    >
                      <span>Delivery</span>
                      {selectedFulfillments.includes("delivery") && (
                        <svg
                          className="w-4 h-4 text-blue-600"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={() => toggleFulfillment("store")}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between"
                    >
                      <span>Store</span>
                      {selectedFulfillments.includes("store") && (
                        <svg
                          className="w-4 h-4 text-blue-600"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={() => toggleFulfillment("person")}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between"
                    >
                      <span>Person</span>
                      {selectedFulfillments.includes("person") && (
                        <svg
                          className="w-4 h-4 text-blue-600"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {(activeTab === "prices" && sortedGroups.length === 0) ||
          (activeTab === "pending" && pendingPrices.length === 0) ? (
            <div className="text-gray-500 text-center py-8 border border-gray-200 rounded-lg">
              {activeTab === "prices"
                ? "No prices available for your location"
                : "No pending prices for this product"}
            </div>
          ) : activeTab === "prices" ? (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Header */}
              <div className="bg-[#F5EDF5]/20 px-4 py-3 text-sm font-medium text-gray-700">
                Prices committed by the community (
                {selectedLocations.length === 0 &&
                selectedFulfillments.length === 0
                  ? sortedGroups.length
                  : `${sortedGroups.length}/${allGroups.length}`}
                )
              </div>

              {/* Price List */}
              <div className="divide-y divide-gray-200">
                {sortedGroups.map((group) => {
                  const priceEntry = group.latest;
                  const olderEntries = group.history;
                  const isExpanded = expandedGroups.includes(group.key);
                  const olderCount = olderEntries.length;

                  // Get store name, handling array from Supabase
                  const storeName = Array.isArray(priceEntry.stores)
                    ? priceEntry.stores[0]?.name
                    : priceEntry.stores?.name;

                  const priceStatusLabel = priceEntry.is_final_price
                    ? "Final price"
                    : "Partial price";
                  const priceStatusClass = priceEntry.is_final_price
                    ? "bg-emerald-500"
                    : "bg-amber-400";

                  // Format location
                  const location = priceEntry.captured_by_city
                    ? `${priceEntry.captured_by_city}, ${priceEntry.captured_by_country}`
                    : priceEntry.captured_by_country;

                  return (
                    <div key={group.key} className="bg-white">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0 px-4 py-3 hover:bg-gray-50">
                        {/* Left side: Price, Store, Fulfillment, Price Type */}
                        <div className="flex items-center gap-2 text-sm text-gray-900">
                          {priceEntry.source_url ? (
                            <a
                              href={priceEntry.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-blue-600"
                            >
                              <PriceBreakdownTooltip
                                price={priceEntry.price}
                                basePrice={priceEntry.base_price}
                                shippingCost={priceEntry.shipping_cost}
                                fees={priceEntry.fees}
                                currency={priceEntry.currency || "USD"}
                                isFinalPrice={priceEntry.is_final_price}
                              >
                                <span className="inline-flex items-center gap-2">
                                  <span
                                    className={`h-2.5 w-2.5 rounded-full ${priceStatusClass} ring-1 ring-gray-300`}
                                    role="img"
                                    aria-label={priceStatusLabel}
                                    title={priceStatusLabel}
                                  />
                                  <PriceDisplay
                                    price={priceEntry.price}
                                    currency={priceEntry.currency || "USD"}
                                  />
                                  {" @ "}
                                  {storeName || priceEntry.source}
                                </span>
                              </PriceBreakdownTooltip>
                            </a>
                          ) : (
                            <span>
                              <PriceBreakdownTooltip
                                price={priceEntry.price}
                                basePrice={priceEntry.base_price}
                                shippingCost={priceEntry.shipping_cost}
                                fees={priceEntry.fees}
                                currency={priceEntry.currency || "USD"}
                                isFinalPrice={priceEntry.is_final_price}
                              >
                                <span className="inline-flex items-center gap-2">
                                  <span
                                    className={`h-2.5 w-2.5 rounded-full ${priceStatusClass} ring-1 ring-gray-300`}
                                    role="img"
                                    aria-label={priceStatusLabel}
                                    title={priceStatusLabel}
                                  />
                                  <PriceDisplay
                                    price={priceEntry.price}
                                    currency={priceEntry.currency || "USD"}
                                  />
                                  {" @ "}
                                  {storeName || priceEntry.source}
                                </span>
                              </PriceBreakdownTooltip>
                            </span>
                          )}
                        </div>

                        {/* Right side: Location, Time, Username (gray) + Screenshot + Recapture */}
                        <div className="flex items-center gap-3 text-sm text-gray-500 sm:text-right">
                          {olderCount > 0 && (
                            <button
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                toggleGroupExpanded(group.key);
                              }}
                              className="text-xs text-gray-500 hover:text-gray-700 hover:border-gray-400 inline-flex items-center gap-1 border border-gray-300 rounded px-1.5 py-0.5 transition-colors flex-shrink-0"
                            >
                              <span>{olderCount}</span>
                              <span aria-hidden="true" className="inline-flex">
                                {isExpanded ? (
                                  <svg
                                    viewBox="0 0 20 20"
                                    className="h-3 w-3"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                  >
                                    <path d="M6 12l4-4 4 4" />
                                  </svg>
                                ) : (
                                  <svg
                                    viewBox="0 0 20 20"
                                    className="h-3 w-3"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                  >
                                    <path d="M6 8l4 4 4-4" />
                                  </svg>
                                )}
                              </span>
                            </button>
                          )}
                          <div className="flex-1">
                            {location} • {formatTimeAgo(priceEntry.created_at)}
                            {priceEntry.submitted_by_username && (
                              <>
                                {" "}
                                •{" "}
                                <Link
                                  href={`/user/${priceEntry.submitted_by_username}`}
                                  className="hover:text-blue-600 hover:underline"
                                >
                                  {priceEntry.submitted_by_username}
                                </Link>
                              </>
                            )}
                            {/* Show pending badge for user's own submissions */}
                            {priceEntry.status === "pending" &&
                              priceEntry.submitted_by === currentUserId && (
                                <>
                                  {" "}
                                  •{" "}
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                    Pending Review
                                  </span>
                                </>
                              )}
                          </div>
                          {/* Recapture Button - moved to the right */}
                          {priceEntry.source_url && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleRecapture(
                                  priceEntry.source_url,
                                  priceEntry.id,
                                );
                              }}
                              disabled={revalidatingId === priceEntry.id}
                              className="px-1.5 py-0.5 text-[10px] bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex-shrink-0 inline-flex items-center gap-1"
                              title="Recapture this price with extension"
                            >
                              <span>
                                {revalidatingId === priceEntry.id
                                  ? "..."
                                  : "Recapture"}
                              </span>
                              {!revalidatingId && (
                                <svg
                                  className="w-2.5 h-2.5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                  />
                                </svg>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                      {olderCount > 0 && isExpanded && (
                        <div className="px-4 pb-3 pl-8 text-xs text-gray-500">
                          <div className="mt-1 space-y-2">
                            {olderEntries.map((entry) => {
                              const entryStoreName = Array.isArray(entry.stores)
                                ? entry.stores[0]?.name
                                : entry.stores?.name;
                              const entryStatusLabel = entry.is_final_price
                                ? "Final price"
                                : "Partial price";
                              const entryStatusClass = entry.is_final_price
                                ? "bg-emerald-500"
                                : "bg-amber-400";

                              return (
                                <div
                                  key={entry.id}
                                  className="flex items-center justify-between gap-3"
                                >
                                  <div className="flex items-center gap-2 text-gray-700">
                                    {entry.source_url ? (
                                      <a
                                        href={entry.source_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="hover:text-blue-600"
                                      >
                                        <PriceBreakdownTooltip
                                          price={entry.price}
                                          basePrice={entry.base_price}
                                          shippingCost={entry.shipping_cost}
                                          fees={entry.fees}
                                          currency={entry.currency || "USD"}
                                          isFinalPrice={entry.is_final_price}
                                        >
                                          <span className="inline-flex items-center gap-2">
                                            <span
                                              className={`h-2 w-2 rounded-full ${entryStatusClass} ring-1 ring-gray-300`}
                                              role="img"
                                              aria-label={entryStatusLabel}
                                              title={entryStatusLabel}
                                            />
                                            <PriceDisplay
                                              price={entry.price}
                                              currency={entry.currency || "USD"}
                                            />
                                            {" @ "}
                                            {entryStoreName || entry.source}
                                          </span>
                                        </PriceBreakdownTooltip>
                                      </a>
                                    ) : (
                                      <PriceBreakdownTooltip
                                        price={entry.price}
                                        basePrice={entry.base_price}
                                        shippingCost={entry.shipping_cost}
                                        fees={entry.fees}
                                        currency={entry.currency || "USD"}
                                        isFinalPrice={entry.is_final_price}
                                      >
                                        <span className="inline-flex items-center gap-2">
                                          <span
                                            className={`h-2 w-2 rounded-full ${entryStatusClass} ring-1 ring-gray-300`}
                                            role="img"
                                            aria-label={entryStatusLabel}
                                            title={entryStatusLabel}
                                          />
                                          <PriceDisplay
                                            price={entry.price}
                                            currency={entry.currency || "USD"}
                                          />
                                          {" @ "}
                                          {entryStoreName || entry.source}
                                        </span>
                                      </PriceBreakdownTooltip>
                                    )}
                                  </div>
                                  <div className="text-gray-400 flex-shrink-0">
                                    {formatTimeAgo(entry.created_at)}
                                    {entry.submitted_by_username && (
                                      <>
                                        {" "}
                                        •{" "}
                                        <Link
                                          href={`/user/${entry.submitted_by_username}`}
                                          className="hover:text-blue-600 hover:underline"
                                        >
                                          {entry.submitted_by_username}
                                        </Link>
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Header */}
              <div className="bg-yellow-50 px-4 py-3 text-sm font-medium text-gray-700">
                Pending verification ({pendingPrices.length})
              </div>

              {/* Pending Price List */}
              <div className="divide-y divide-gray-200">
                {(() => {
                  console.log(
                    "Before conditional - pendingPrices.length:",
                    pendingPrices.length,
                  );
                  console.log(
                    "Before conditional - check result:",
                    pendingPrices.length === 0,
                  );
                  return null;
                })()}
                {pendingPrices.length === 0 ? (
                  <div className="px-4 py-8 text-center text-gray-500">
                    No pending prices for this product
                  </div>
                ) : (
                  pendingPrices.map((priceEntry) => {
                    console.log("Rendering pending price entry:", priceEntry);

                    // Get store name, handling array from Supabase
                    const storeName = Array.isArray(priceEntry.stores)
                      ? priceEntry.stores[0]?.name
                      : priceEntry.stores?.name;

                    const priceStatusLabel = priceEntry.is_final_price
                      ? "Final price"
                      : "Partial price";
                    const priceStatusClass = priceEntry.is_final_price
                      ? "bg-emerald-500"
                      : "bg-amber-400";

                    // Format location
                    const location = priceEntry.captured_by_city
                      ? `${priceEntry.captured_by_city}, ${priceEntry.captured_by_country}`
                      : priceEntry.captured_by_country;

                    // Handle submitted_by_user which can be array or object from Supabase
                    const submittedByUser = priceEntry.submitted_by_user;
                    const username = Array.isArray(submittedByUser)
                      ? submittedByUser[0]?.username
                      : submittedByUser?.username;

                    return (
                      <div
                        key={priceEntry.id}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0 px-4 py-3 bg-yellow-50/30 hover:bg-yellow-50"
                      >
                        {/* Screenshot Thumbnail */}
                        {/* Left side: Price, Store, Fulfillment, Price Type */}
                        <div className="text-sm text-gray-900">
                          {priceEntry.source_url ? (
                            <a
                              href={priceEntry.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-blue-600"
                            >
                              <PriceBreakdownTooltip
                                price={priceEntry.price}
                                basePrice={priceEntry.base_price}
                                shippingCost={priceEntry.shipping_cost}
                                fees={priceEntry.fees}
                                currency={priceEntry.currency || "USD"}
                                isFinalPrice={priceEntry.is_final_price}
                              >
                                <span className="inline-flex items-center gap-2">
                                  <span
                                    className={`h-2.5 w-2.5 rounded-full ${priceStatusClass} ring-1 ring-gray-300`}
                                    role="img"
                                    aria-label={priceStatusLabel}
                                    title={priceStatusLabel}
                                  />
                                  <PriceDisplay
                                    price={priceEntry.price}
                                    currency={priceEntry.currency || "USD"}
                                  />
                                  {" @ "}
                                  {storeName || priceEntry.source}
                                </span>
                              </PriceBreakdownTooltip>
                            </a>
                          ) : (
                            <span>
                              <PriceBreakdownTooltip
                                price={priceEntry.price}
                                basePrice={priceEntry.base_price}
                                shippingCost={priceEntry.shipping_cost}
                                fees={priceEntry.fees}
                                currency={priceEntry.currency || "USD"}
                                isFinalPrice={priceEntry.is_final_price}
                              >
                                <span className="inline-flex items-center gap-2">
                                  <span
                                    className={`h-2.5 w-2.5 rounded-full ${priceStatusClass} ring-1 ring-gray-300`}
                                    role="img"
                                    aria-label={priceStatusLabel}
                                    title={priceStatusLabel}
                                  />
                                  <PriceDisplay
                                    price={priceEntry.price}
                                    currency={priceEntry.currency || "USD"}
                                  />
                                  {" @ "}
                                  {storeName || priceEntry.source}
                                </span>
                              </PriceBreakdownTooltip>
                            </span>
                          )}
                        </div>

                        {/* Right side: Location, Time, Username, Action Buttons + Screenshot */}
                        <div className="text-sm text-gray-500 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                          <span>
                            {location} • {formatTimeAgo(priceEntry.created_at)}
                            {username && (
                              <>
                                {" "}
                                •{" "}
                                <Link
                                  href={`/user/${username}`}
                                  className="hover:text-blue-600 hover:underline"
                                >
                                  {username}
                                </Link>
                              </>
                            )}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                const isModerator =
                                  userProfile?.role === "moderator" ||
                                  userProfile?.role === "admin";
                                if (isModerator) {
                                  setShowReviewModal(priceEntry.id);
                                } else {
                                  setShowNonModeratorModal(true);
                                }
                              }}
                              disabled={reviewingId === priceEntry.id}
                              className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              Review
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Location Modal */}
      <LocationModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        onSave={handleLocationSave}
        currentLocation={userLocation}
      />

      {/* Review Modal */}
      {showReviewModal &&
        (() => {
          const priceToReview = pendingPricesState.find(
            (p) => p.id === showReviewModal,
          );
          if (!priceToReview) return null;

          // Normalize stores (might be array from Supabase)
          const stores = Array.isArray(priceToReview.stores)
            ? priceToReview.stores[0]
            : priceToReview.stores;
          const submitted_by_user = Array.isArray(
            priceToReview.submitted_by_user,
          )
            ? priceToReview.submitted_by_user?.[0]
            : priceToReview.submitted_by_user;

          // Use parent product data since this is already on the product page
          const productData = {
            id: product.id,
            name: product.name,
          };

          // Ensure we have valid stores
          if (!stores) {
            console.error("Missing stores data:", { stores, priceToReview });
            return null;
          }

          return (
            <PriceReviewModal
              priceData={{
                id: priceToReview.id,
                price: priceToReview.price,
                base_price: priceToReview.base_price ?? null,
                shipping_cost: priceToReview.shipping_cost ?? null,
                fees: priceToReview.fees ?? null,
                currency: priceToReview.currency || "USD",
                source_url: priceToReview.source_url ?? null,
                created_at: priceToReview.created_at,
                captured_by_country: priceToReview.captured_by_country ?? null,
                captured_by_city: priceToReview.captured_by_city ?? null,
                condition: priceToReview.condition ?? null,
                fulfillment_type: priceToReview.fulfillment_type ?? null,
                product_type: priceToReview.product_type ?? null,
                is_final_price: priceToReview.is_final_price ?? false,
                screenshot_url: priceToReview.screenshot_url ?? null,
                products: productData,
                stores: stores,
                submitted_by_user: submitted_by_user,
              }}
              onApprove={handleApprove}
              onReject={handleReject}
              onClose={() => setShowReviewModal(null)}
              isReviewing={reviewingId === showReviewModal}
            />
          );
        })()}

      {/* Non-Moderator Modal */}
      {showNonModeratorModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">
              Moderator Access Required
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Only moderators can review price submissions. If you believe a
              submission is incorrect, please wait for a moderator to review it.
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setShowNonModeratorModal(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Extension Install Modal */}
      {showExtensionInstallModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowExtensionInstallModal(false)}
          />
          <div className="relative bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-8 max-w-lg w-full mx-4 shadow-2xl border border-blue-100">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mb-4">
                <span className="text-4xl">🪙</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                You need the PriceGit Extension to capture prices
              </h3>
              <p className="text-gray-600 text-base leading-relaxed">
                Install it now and help the community verify accurate prices
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowExtensionInstallModal(false)}
                className="flex-1 px-6 py-3 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Maybe Later
              </button>
              <button
                onClick={handleInstallExtension}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                Get Extension
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
