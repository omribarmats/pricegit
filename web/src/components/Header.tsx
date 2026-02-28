"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Product, UserLocation } from "@/types";
import { slugify } from "@/lib/slugify";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { usePathname } from "next/navigation";
import { HowItWorksModal } from "./HowItWorksModal";
import { LocationModal } from "./LocationModal";
import {
  getUserLocationFromIP,
  getStoredLocation,
  setStoredLocation,
} from "@/lib/location";

export function Header() {
  const pathname = usePathname();
  const isProductPage = pathname?.startsWith("/product/");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const router = useRouter();
  const searchRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { user, userProfile, signOut, loading } = useAuth();
  const isModerator =
    userProfile?.role === "moderator" || userProfile?.role === "admin";

  // Username comes from userProfile in AuthContext - no need to fetch
  const username = userProfile?.username || null;

  // Initialize location
  useEffect(() => {
    const initializeLocation = async () => {
      const stored = getStoredLocation();
      if (stored) {
        setUserLocation(stored);
        return;
      }

      const ipLocation = await getUserLocationFromIP();
      if (ipLocation) {
        setUserLocation(ipLocation);
        setStoredLocation(ipLocation);
      }
    };

    initializeLocation();
  }, []);

  const handleLocationSave = (location: UserLocation) => {
    setUserLocation(location);
    setStoredLocation(location);
  };

  // Fetch pending prices count for review
  useEffect(() => {
    async function fetchPendingCount() {
      if (!user || !isModerator) {
        setPendingCount(0);
        return;
      }

      const { count, error } = await supabase
        .from("price_history")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .neq("submitted_by", user.id); // Exclude user's own submissions

      if (!error && count !== null) {
        setPendingCount(count);
      }
    }

    fetchPendingCount();
    // Refresh every 30 seconds
    const interval = setInterval(fetchPendingCount, 30000);
    return () => clearInterval(interval);
  }, [user, isModerator]);

  useEffect(() => {
    const searchProducts = async () => {
      if (query.trim().length < 2) {
        setSuggestions([]);
        setIsOpen(false);
        return;
      }

      const { data, error } = await supabase
        .from("products")
        .select("id, name")
        .ilike("name", `%${query}%`)
        .limit(5);

      // Only log real errors (not empty objects)
      if (error && Object.keys(error).length > 0 && error.message) {
        console.error("Search error:", error);
      }

      if (data) {
        setSuggestions(data as unknown as Product[]);
        setIsOpen(true);
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
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleProductClick = (product: Product) => {
    setQuery("");
    setSuggestions([]);
    setIsOpen(false);
    router.push(`/product/${product.id}/${slugify(product.name)}`);
  };

  return (
    <header
      className={`bg-[#F5EDF5]/20 ${
        isProductPage ? "" : "border-b border-gray-200"
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 pb-6 sm:pb-8">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 md:gap-8">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <span className="text-2xl sm:text-3xl">🪙</span>
            <span className="text-lg sm:text-2xl font-bold text-gray-900">
              PriceGit
            </span>
          </Link>

          {/* Auth UI - appears on mobile before search due to flex order */}
          <div className="flex items-center gap-2 sm:gap-4 ml-auto sm:order-3">
            {/* How it works button */}
            <button
              onClick={() => setHowItWorksOpen(true)}
              className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors cursor-pointer"
            >
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="hidden sm:inline">How it works</span>
            </button>

            {loading ? (
              // Show placeholder while checking auth
              <div className="w-12 sm:w-20 h-9" />
            ) : user ? (
              <div ref={userMenuRef} className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
                >
                  {username ? (
                    <span className="max-w-[80px] sm:max-w-none truncate">
                      {username}
                    </span>
                  ) : (
                    <span className="w-12 sm:w-20 h-4 bg-gray-200 rounded animate-pulse" />
                  )}
                  <svg
                    className={`w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0 transition-transform ${
                      userMenuOpen ? "rotate-180" : ""
                    }`}
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

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                    <div className="py-1">
                      {username && (
                        <Link
                          href={`/user/${username}`}
                          className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          onClick={() => setUserMenuOpen(false)}
                        >
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
                              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                            />
                          </svg>
                          My Profile
                        </Link>
                      )}
                      {isModerator && (
                        <Link
                          href="/moderate"
                          className="flex items-center justify-between px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <div className="flex items-center gap-3">
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
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            Review Prices
                          </div>
                          {pendingCount > 0 && (
                            <span className="bg-blue-600 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                              {pendingCount}
                            </span>
                          )}
                        </Link>
                      )}
                      <Link
                        href="/settings"
                        className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setUserMenuOpen(false)}
                      >
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
                            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        Account Settings
                      </Link>
                      <button
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          try {
                            // Sign out and wait for it to complete
                            await signOut();
                          } catch {
                            // Redirect below handles cleanup regardless
                          }
                          // Redirect regardless of success/failure to clear all state
                          window.location.href = "/";
                        }}
                        className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
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
                            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                          />
                        </svg>
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1 sm:gap-2">
                <Link
                  href="/login"
                  className="px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                >
                  <span className="hidden sm:inline">Sign In</span>
                  <span className="sm:hidden">In</span>
                </Link>
                <Link
                  href="/signup"
                  className="px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                >
                  <span className="hidden sm:inline">Sign Up</span>
                  <span className="sm:hidden">Up</span>
                </Link>
              </div>
            )}
          </div>

          {/* Search Bar - full width on mobile (wraps to new row), flex-1 on larger screens */}
          <div className="w-full sm:w-auto sm:flex-1 sm:max-w-2xl relative sm:order-2">
            <div ref={searchRef} className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for products"
                className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      {product.hasAvailableStores && (
                        <div className="text-sm text-green-600 mt-1">
                          Available in your area
                        </div>
                      )}
                      {!product.hasAvailableStores && (
                        <div className="text-sm text-gray-500 mt-1">
                          No local suppliers
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Current Location - positioned absolutely to not affect flex alignment */}
            <div className="absolute top-full left-0 mt-1 text-xs text-gray-500 truncate max-w-full">
              <span className="hidden sm:inline">Current location: </span>
              {userLocation ? (
                <>
                  <span>
                    {userLocation.city}, {userLocation.country}
                  </span>
                  <button
                    onClick={() => setIsLocationModalOpen(true)}
                    className="text-blue-600 hover:text-blue-700 ml-1 cursor-pointer"
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
        </div>
      </div>

      {/* How It Works Modal */}
      <HowItWorksModal
        isOpen={howItWorksOpen}
        onClose={() => setHowItWorksOpen(false)}
      />

      {/* Location Modal */}
      <LocationModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        onSave={handleLocationSave}
        currentLocation={userLocation}
      />
    </header>
  );
}
