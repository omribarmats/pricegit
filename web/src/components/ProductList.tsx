"use client";

import { useState, useEffect, ReactElement } from "react";
import Link from "next/link";
import { PriceChart } from "./PriceChart";
import { Product, UserLocation } from "@/types";
import { calculateDistance } from "@/lib/distance";
import { slugify } from "@/lib/slugify";
import {
  convertCurrency,
  formatOriginalPrice,
  getCurrencyForCountry,
  getCurrencySymbol,
} from "@/lib/currency";

interface ProductListProps {
  products: Product[];
  userLocation?: UserLocation;
  onEditLocation?: () => void;
}

interface LatestPrice {
  source: string;
  price: number;
  source_url: string;
  created_at: string;
  store_id: string;
  condition?: string;
  fulfillment_type?: string;
  product_type?: string;
  currency?: string;
  stores?: Product["price_history"][0]["stores"];
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

// Component to display price with currency conversion
function PriceDisplay({
  price,
  storeCurrency,
  userCurrency,
}: {
  price: number;
  storeCurrency: string;
  userCurrency: string;
}) {
  const [convertedPrice, setConvertedPrice] = useState<number>(price);
  const isSameCurrency = storeCurrency === userCurrency;

  useEffect(() => {
    if (isSameCurrency) {
      return;
    }

    convertCurrency(price, storeCurrency, userCurrency).then((converted) => {
      setConvertedPrice(converted);
    });
  }, [price, storeCurrency, userCurrency, isSameCurrency]);

  const displayPrice = isSameCurrency ? price : convertedPrice;
  const currencySymbol = getCurrencySymbol(userCurrency);
  const [whole, decimal] = displayPrice.toFixed(2).split(".");

  return (
    <div className="flex flex-col">
      <div className="flex flex-row items-baseline">
        <span className="text-gray-700 group-hover:text-gray-500 font-normal mr-0.5">
          {currencySymbol}
        </span>
        <span className="font-normal text-gray-900 group-hover:text-gray-500 leading-none">
          {whole}
        </span>
        <span className="text-xs text-gray-700 group-hover:text-gray-500 font-normal ml-0.5">
          {decimal}
        </span>
      </div>
      {!isSameCurrency && (
        <span className="text-xs text-gray-500 group-hover:text-gray-400">
          {formatOriginalPrice(price, storeCurrency)}
        </span>
      )}
    </div>
  );
}

function getLatestPricePerStore(
  priceHistory: Product["price_history"]
): LatestPrice[] {
  const storeMap = new Map<string, LatestPrice>();

  priceHistory.forEach((history: Product["price_history"][0]) => {
    const existing = storeMap.get(history.source);
    if (
      !existing ||
      new Date(history.created_at) > new Date(existing.created_at)
    ) {
      storeMap.set(history.source, {
        source: history.source,
        price: history.price,
        source_url: history.source_url,
        created_at: history.created_at,
        store_id: history.store_id,
        condition: history.condition,
        fulfillment_type: history.fulfillment_type,
        product_type: history.product_type,
        currency: history.currency,
        stores: history.stores,
      });
    }
  });

  return Array.from(storeMap.values()).sort((a, b) => {
    // Priority order: new items first, then used items (all private sellers) at the end
    const aCondition = a.condition || "new";
    const bCondition = b.condition || "new";

    // 1. New items always come first, used items at the end
    if (aCondition !== bCondition) {
      return aCondition === "new" ? -1 : 1;
    }

    // 2. Within the same condition, sort by price
    return a.price - b.price;
  });
}

function getFulfillmentBadge(
  latest: LatestPrice,
  userLocation?: UserLocation
): { icon: ReactElement; text: string; color: string } | null {
  if (!latest.stores) return null;

  const store = Array.isArray(latest.stores) ? latest.stores[0] : latest.stores;
  if (!store) return null;

  // Second-hand items (all from private sellers)
  if (latest.condition === "used") {
    if (
      userLocation &&
      store.latitude &&
      store.longitude &&
      userLocation.latitude &&
      userLocation.longitude
    ) {
      const distance = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        store.latitude,
        store.longitude
      );
      return {
        icon: <span>🫲</span>,
        text: `2nd hand •  ${distance.toFixed(1)}`,
        color: "text-gray-600",
      };
    }
    return {
      icon: <span>🫲</span>,
      text: "2nd hand • Private seller",
      color: "text-gray-600",
    };
  }

  // Digital products
  if (latest.product_type === "digital") {
    return {
      icon: <span>🛬</span>,
      text: "Digital",
      color: "text-gray-600",
    };
  }

  // Physical products - Store only
  if (latest.fulfillment_type === "store") {
    if (
      userLocation &&
      store.latitude &&
      store.longitude &&
      userLocation.latitude &&
      userLocation.longitude
    ) {
      const distance = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        store.latitude,
        store.longitude
      );
      return {
        icon: <span>🏪</span>,
        text: `in-store (${distance.toFixed(1)}km)`,
        color: "text-gray-600",
      };
    }
    return {
      icon: <span>🏪</span>,
      text: "in-store",
      color: "text-gray-600",
    };
  }

  // Physical products - Delivery
  if (latest.fulfillment_type === "delivery") {
    switch (store.shipping_scope) {
      case "local":
      case "national":
        return {
          icon: <span>🚚</span>,
          text: "Local delivery",
          color: "text-gray-600",
        };

      case "international":
      case "global":
        return {
          icon: <span>🛬</span>,
          text: "international delivery",
          color: "text-gray-600",
        };
    }
  }

  return null;
}

export function ProductList({
  products,
  userLocation,
  onEditLocation,
}: ProductListProps) {
  const [selectedChart, setSelectedChart] = useState<{
    productId: string;
    source: string;
  } | null>(null);

  // Persistent filters using localStorage
  const getInitialFilters = () => {
    const defaultFilters = {
      showInternational: true,
      showLocal: true,
      showInStore: true,
      showSecondHand: true,
    };

    if (typeof window === "undefined") {
      return defaultFilters;
    }

    try {
      const saved = localStorage.getItem("priceFilters");
      if (saved) {
        const parsed = JSON.parse(saved);
        // Ensure all properties exist, merge with defaults
        return {
          showInternational: parsed.showInternational ?? true,
          showLocal: parsed.showLocal ?? true,
          showInStore: parsed.showInStore ?? true,
          showSecondHand: parsed.showSecondHand ?? true,
        };
      }
    } catch (error) {
      console.error("Error reading filters from localStorage:", error);
    }

    return defaultFilters;
  };

  const [filters, setFilters] = useState<{
    showInternational: boolean;
    showLocal: boolean;
    showInStore: boolean;
    showSecondHand: boolean;
  }>(getInitialFilters);

  // Save filters to localStorage whenever they change
  const updateFilter = (key: keyof typeof filters, value: boolean) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    if (typeof window !== "undefined") {
      localStorage.setItem("priceFilters", JSON.stringify(newFilters));
    }
  };

  // Filter prices based on selected filters
  const filterPrices = (prices: LatestPrice[]) => {
    return prices.filter((price) => {
      if (!price.stores) return true;

      const store = Array.isArray(price.stores) ? price.stores[0] : price.stores;

      // Second-hand (used items)
      if (price.condition === "used") {
        return filters.showSecondHand;
      }

      // Digital products (always international/global)
      if (price.product_type === "digital") {
        return filters.showInternational;
      }

      // Physical products
      if (price.product_type === "physical") {
        // Store only
        if (price.fulfillment_type === "store") {
          return filters.showInStore;
        }

        // Delivery
        if (price.fulfillment_type === "delivery") {
          const scope = store?.shipping_scope;

          // International/global delivery
          if (scope === "international" || scope === "global") {
            return filters.showInternational;
          }

          // Local/national delivery
          if (scope === "local" || scope === "national") {
            return filters.showLocal;
          }
        }
      }

      return true;
    });
  };

  return (
    <>
      <div className="space-y-6">
        {products.map((product) => {
          // Filter by user's country first (regional pricing)
          const regionalPrices = (product.price_history || []).filter((ph) => {
            // For global_fixed stores, show all prices
            const store = Array.isArray(ph.stores) ? ph.stores[0] : ph.stores;
            if (store?.pricing_model === "global_fixed") {
              return true;
            }
            // For regional_variable stores, only show prices captured in user's country
            return ph.captured_by_country === userLocation?.country;
          });

          const allPrices = getLatestPricePerStore(regionalPrices);
          const latestPrices = filterPrices(allPrices);
          const hasStores = latestPrices.length > 0;

          return (
            <div key={product.id} className="pb-6">
              <h2 className="text-3xl font-bold mb-8">
                <Link
                  href={`/product/${product.id}/${slugify(product.name)}`}
                  className="text-gray-900 hover:text-blue-600 transition-colors"
                >
                  {product.name}
                </Link>
              </h2>

              {/* Filter Controls */}
              <div className="mb-9 flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.showInternational}
                    onChange={(e) =>
                      updateFilter("showInternational", e.target.checked)
                    }
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span>🛬</span>
                  <span className="text-gray-700">International shipping</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.showLocal}
                    onChange={(e) =>
                      updateFilter("showLocal", e.target.checked)
                    }
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span>🚚</span>
                  <span className="text-gray-700">Local shipping</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.showInStore}
                    onChange={(e) =>
                      updateFilter("showInStore", e.target.checked)
                    }
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span>🏪</span>
                  <span className="text-gray-700">In-store</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.showSecondHand}
                    onChange={(e) =>
                      updateFilter("showSecondHand", e.target.checked)
                    }
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span>🫲</span>
                  <span className="text-gray-700">2nd hand</span>
                </label>
              </div>
              {/* Display prices if available, otherwise show no suppliers message */}
              {hasStores ? (
                <div>
                  {latestPrices.map((latest) => {
                    const badge = getFulfillmentBadge(latest, userLocation);
                    return (
                      <div
                        key={latest.source}
                        className="flex flex-wrap items-center gap-2 sm:grid sm:grid-cols-[minmax(100px,auto)_minmax(150px,auto)_minmax(40px,auto)_minmax(100px,auto)] sm:gap-8 py-4 border-b border-gray-200 last:border-b-0"
                      >
                        {/* Price - left aligned with link */}
                        <div className="flex items-center justify-start self-center">
                          {latest.source_url ? (
                            <a
                              href={latest.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group text-gray-700 text-sm cursor-pointer"
                            >
                              <PriceDisplay
                                price={latest.price}
                                storeCurrency={latest.currency || "USD"}
                                userCurrency={getCurrencyForCountry(
                                  userLocation?.country || "United States"
                                )}
                              />
                            </a>
                          ) : (
                            <span className="text-gray-700 text-sm">
                              <PriceDisplay
                                price={latest.price}
                                storeCurrency={latest.currency || "USD"}
                                userCurrency={getCurrencyForCountry(
                                  userLocation?.country || "United States"
                                )}
                              />
                            </span>
                          )}
                        </div>

                        {/* Store name - left aligned */}
                        <div className="flex items-center justify-start self-center">
                          <span className="text-gray-700 text-sm">
                            {latest.source}
                          </span>
                        </div>

                        {/* Fulfillment badge - left aligned */}
                        <div className="flex items-center justify-start self-center">
                          {badge && (
                            <span
                              className={`inline-flex items-center gap-1.5 text-sm ${badge.color}`}
                            >
                              {badge.icon}
                            </span>
                          )}
                        </div>

                        {/* Price history link - left aligned */}
                        <div className="flex items-center gap-1 text-sm justify-start self-center">
                          <button
                            onClick={() =>
                              setSelectedChart({
                                productId: product.id,
                                source: latest.source,
                              })
                            }
                            className="text-gray-700 hover:text-gray-500 cursor-pointer"
                            title="View price history"
                          >
                            <span className="hidden sm:inline">price history</span>
                            <span className="sm:hidden">📈</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : allPrices.length > 0 ? (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">🔍</span>
                    <div>
                      <p className="text-sm font-medium text-blue-900">
                        No results with current filters
                      </p>
                      <p className="text-xs text-blue-700 mt-1">
                        Try adjusting your filter settings above to see more
                        options.
                      </p>
                    </div>
                  </div>
                </div>
              ) : regionalPrices.length === 0 &&
                (product.price_history || []).length > 0 ? (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">🛬</span>
                    <div>
                      <p className="text-sm font-medium text-yellow-900">
                        No price data for{" "}
                        {userLocation?.country || "your location"}
                      </p>
                      <p className="text-xs text-yellow-700 mt-1">
                        This product has prices from other regions, but none
                        captured by users in your country yet. Price data from
                        other locations may not reflect your actual final price
                        (taxes, shipping, etc).
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">📍</span>
                    <div>
                      <p className="text-sm font-medium text-amber-900">
                        No suppliers available for your location
                      </p>
                      <p className="text-xs text-amber-700 mt-1">
                        This product is not currently available from stores that
                        can serve your area.{" "}
                        {onEditLocation && (
                          <button
                            onClick={onEditLocation}
                            className="hover:cursor-pointer underline underline-offset-4"
                          >
                            Try changing your location
                          </button>
                        )}
                        {!onEditLocation && "Try changing your location"} to see
                        more options.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {selectedChart && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedChart(null)}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-2xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {products.find((p) => p.id === selectedChart.productId)?.name} -{" "}
                {selectedChart.source}
              </h3>
              <button
                onClick={() => setSelectedChart(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <PriceChart
              data={
                products.find((p) => p.id === selectedChart.productId)
                  ?.price_history || []
              }
              source={selectedChart.source}
            />
          </div>
        </div>
      )}
    </>
  );
}

export default ProductList;
