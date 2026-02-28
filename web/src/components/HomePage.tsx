"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { UserLocation, Product } from "@/types";
import { LocationModal } from "./LocationModal";
import { supabase } from "@/lib/supabase";
import { slugify } from "@/lib/slugify";
import {
  getUserLocationFromIP,
  getStoredLocation,
  setStoredLocation,
} from "@/lib/location";

interface Stats {
  productCount: number;
  priceCount: number;
  userCount: number;
}

interface RecentActivity {
  id: string;
  productId: string;
  productName: string;
  username: string;
  price: number;
  storeName: string;
  storeUrl: string;
  createdAt: string;
}

interface PopularProduct {
  id: string;
  name: string;
}

interface HomePageProps {
  initialStats: Stats;
  initialRecentActivity: RecentActivity[];
  initialPopularProducts: PopularProduct[];
}

function formatTimeAgo(date: string): string {
  const now = new Date();
  const past = new Date(date);
  const diffInMs = now.getTime() - past.getTime();
  const minutes = Math.floor(diffInMs / (1000 * 60));
  const hours = Math.floor(diffInMs / (1000 * 60 * 60));

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function HomePage({
  initialStats,
  initialRecentActivity,
  initialPopularProducts,
}: HomePageProps) {
  const router = useRouter();
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);

  // Search state
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Use server-provided data directly
  const stats = initialStats;
  const recentActivity = initialRecentActivity;
  const popularProducts = initialPopularProducts;

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

  // Search products
  useEffect(() => {
    const searchProducts = async () => {
      if (query.trim().length < 2) {
        setSuggestions([]);
        setIsOpen(false);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);

      try {
        const { data, error } = await supabase
          .from("products")
          .select("id, name")
          .ilike("name", `%${query}%`)
          .limit(5);

        if (error) {
          console.error("Search error:", error);
          setIsSearching(false);
          return;
        }

        setSuggestions((data || []) as unknown as Product[]);
        setIsOpen(true);
      } catch (err) {
        console.error("Search exception:", err);
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(searchProducts, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLocationSave = (location: UserLocation) => {
    setUserLocation(location);
    setStoredLocation(location);
  };

  const handleProductClick = (product: Product | PopularProduct) => {
    setQuery("");
    setSuggestions([]);
    setIsOpen(false);
    router.push(`/product/${product.id}/${slugify(product.name)}`);
  };

  if (isLoadingLocation) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-500">Detecting your location...</div>
      </div>
    );
  }

  return (
    <div className="bg-white">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-16">
        {/* Hero Text */}
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-3 sm:mb-4">
            Shared Price Knowledge
          </h1>
          <p className="text-base sm:text-lg text-gray-600 mb-3">
            Compare prices submitted by shoppers near you
          </p>
          <div className="flex items-center justify-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600">
            <span className="flex items-center gap-1">✓ Bootstrapped</span>
            <span className="flex items-center gap-1">✓ Open-source</span>
            <span className="flex items-center gap-1">
              ✓ Community Verified
            </span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="max-w-2xl mx-auto mb-8 sm:mb-12">
          <div ref={searchRef} className="relative mb-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for products"
              className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            />

            {/* Suggestions Dropdown */}
            {isOpen && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                {suggestions.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => handleProductClick(product)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                  >
                    <div className="font-medium text-gray-900">
                      {product.name}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Loading state */}
            {isSearching && query.trim().length >= 2 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-4 text-sm text-gray-500">
                Searching...
              </div>
            )}

            {/* No results */}
            {isOpen &&
              !isSearching &&
              query.trim().length >= 2 &&
              suggestions.length === 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-4 text-sm text-gray-500">
                  No products found matching &quot;{query}&quot;
                </div>
              )}
          </div>

          {/* Current Location */}
          <div className="text-left text-xs sm:text-sm text-gray-500 mt-1">
            <span className="hidden sm:inline">Current location: </span>
            {userLocation ? (
              <>
                <span>
                  {userLocation.city}, {userLocation.country}
                </span>
                <button
                  onClick={() => setIsLocationModalOpen(true)}
                  className="text-blue-600 hover:text-blue-700 ml-2 cursor-pointer"
                >
                  Edit
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsLocationModalOpen(true)}
                className="text-blue-600 hover:text-blue-700 cursor-pointer"
              >
                Set location
              </button>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="mb-8 sm:mb-12">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 text-center mb-3 sm:mb-4">
            Recent activity
          </h2>
          {recentActivity.length > 0 ? (
            <div className="space-y-2">
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between py-2 px-3 sm:px-4 bg-[#F5EDF5]/20 rounded-lg text-xs sm:text-sm gap-1 sm:gap-0"
                >
                  <span className="text-gray-600">
                    <a
                      href={`/user/${activity.username}`}
                      className="text-gray-900 hover:text-blue-600 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {activity.username}
                    </a>{" "}
                    captured{" "}
                    <a
                      href={activity.storeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-900 hover:text-blue-600 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      ${(activity.price || 0).toFixed(2)} @ {activity.storeName}
                    </a>{" "}
                    for{" "}
                    <a
                      href={`/product/${activity.productId}/${slugify(activity.productName)}`}
                      className="text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      {activity.productName}
                    </a>
                  </span>
                  <span className="text-gray-400 text-xs">
                    {formatTimeAgo(activity.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 text-sm">
              No recent activity yet. Be the first to capture a price!
            </p>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-8 sm:mb-12">
          <div className="text-center p-2 sm:p-4 bg-[#F5EDF5]/20 rounded-lg">
            <div className="text-lg sm:text-2xl font-bold text-gray-900">
              {stats.productCount}
            </div>
            <div className="text-xs sm:text-sm text-gray-500">
              Products tracked
            </div>
          </div>
          <div className="text-center p-2 sm:p-4 bg-[#F5EDF5]/20 rounded-lg">
            <div className="text-lg sm:text-2xl font-bold text-gray-900">
              {stats.priceCount}
            </div>
            <div className="text-xs sm:text-sm text-gray-500">
              Prices captured
            </div>
          </div>
          <div className="text-center p-2 sm:p-4 bg-[#F5EDF5]/20 rounded-lg">
            <div className="text-lg sm:text-2xl font-bold text-gray-900">
              {stats.userCount}
            </div>
            <div className="text-xs sm:text-sm text-gray-500">Contributors</div>
          </div>
        </div>

        {/* Popular Products */}
        {popularProducts.length > 0 && (
          <div className="mb-8 sm:mb-12">
            <p className="text-center text-xs sm:text-sm text-gray-500 mb-3">
              Popular products:
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {popularProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => handleProductClick(product)}
                  className="px-2 sm:px-3 py-1 sm:py-1.5 bg-[#F5EDF5]/20 hover:bg-[#F5EDF5]/30 text-gray-700 text-xs sm:text-sm rounded-full transition-colors cursor-pointer"
                >
                  {product.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Location Modal */}
      <LocationModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        onSave={handleLocationSave}
        currentLocation={userLocation}
      />
    </div>
  );
}
