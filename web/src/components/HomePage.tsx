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
          .select("id, name, image_url")
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
      <main className="max-w-4xl mx-auto px-6 py-16">
        {/* Hero Text */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-semibold text-gray-900 mb-4">
            Community Verified Prices
          </h1>
          <p className="text-lg text-gray-600">
            Get prices from around the world,
            <br />
            Captured by others - relevant to your location
          </p>
        </div>

        {/* Search Bar */}
        <div ref={searchRef} className="relative mb-4 max-w-2xl mx-auto">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for products"
            className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
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
                  <div className="font-medium text-gray-900">{product.name}</div>
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
          {isOpen && !isSearching && query.trim().length >= 2 && suggestions.length === 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-4 text-sm text-gray-500">
              No products found matching &quot;{query}&quot;
            </div>
          )}
        </div>

        {/* Current Location */}
        <div className="text-center text-sm text-gray-500 mb-12">
          Current Location:{" "}
          {userLocation ? (
            <>
              <span>
                {userLocation.city}, {userLocation.country}
              </span>
              <button
                onClick={() => setIsLocationModalOpen(true)}
                className="text-blue-600 hover:text-blue-700 ml-2"
              >
                Edit
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsLocationModalOpen(true)}
              className="text-blue-600 hover:text-blue-700"
            >
              Set location
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-12">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">{stats.productCount}</div>
            <div className="text-sm text-gray-500">Products tracked</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">{stats.priceCount}</div>
            <div className="text-sm text-gray-500">Prices captured</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">{stats.userCount}</div>
            <div className="text-sm text-gray-500">Contributors</div>
          </div>
        </div>

        {/* Popular Products */}
        {popularProducts.length > 0 && (
          <div className="mb-12">
            <p className="text-center text-sm text-gray-500 mb-3">Popular products:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {popularProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => handleProductClick(product)}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-full transition-colors cursor-pointer"
                >
                  {product.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* How It Works */}
        <div className="mb-12">
          <h2 className="text-lg font-semibold text-gray-900 text-center mb-6">How it works</h2>
          <div className="grid grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3 text-lg font-semibold">1</div>
              <h3 className="font-medium text-gray-900 mb-1">Capture</h3>
              <p className="text-sm text-gray-500">Use our browser extension to capture prices while you shop online</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3 text-lg font-semibold">2</div>
              <h3 className="font-medium text-gray-900 mb-1">Share</h3>
              <p className="text-sm text-gray-500">Your captured prices are shared with the community automatically</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3 text-lg font-semibold">3</div>
              <h3 className="font-medium text-gray-900 mb-1">Compare</h3>
              <p className="text-sm text-gray-500">See prices from different stores and locations to find the best deal</p>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        {recentActivity.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 text-center mb-4">Recent activity</h2>
            <div className="space-y-2">
              {recentActivity.map((activity) => (
                <button
                  key={activity.id}
                  onClick={() => router.push(`/product/${activity.productId}/${slugify(activity.productName)}`)}
                  className="w-full flex items-center justify-between py-2 px-4 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm cursor-pointer transition-colors"
                >
                  <span className="text-gray-600">
                    <span className="font-medium text-gray-900">{activity.username}</span>
                    {" "}added a price for{" "}
                    <span className="font-medium text-blue-600 hover:text-blue-700">{activity.productName}</span>
                  </span>
                  <span className="text-gray-400 text-xs">{formatTimeAgo(activity.createdAt)}</span>
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
