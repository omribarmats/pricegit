"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Product, UserLocation } from "@/types";
import { canStoreServeUser } from "@/lib/storeFilters";

interface SearchBarProps {
  onProductSelect: (product: Product | null) => void;
  userLocation: UserLocation | null;
  onEditLocation: () => void;
}

export function SearchBar({
  onProductSelect,
  userLocation,
  onEditLocation,
}: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedProductName, setSelectedProductName] = useState("");

  useEffect(() => {
    const searchProducts = async () => {
      if (query.trim().length < 2) {
        setSuggestions([]);
        setIsOpen(false);
        return;
      }

      if (!userLocation) {
        setSuggestions([]);
        setIsOpen(false);
        return;
      }

      // Don't search if the query matches the selected product name
      if (query === selectedProductName) {
        return;
      }

      const { data, error } = await supabase
        .from("products")
        .select(
          `
          id,
          name,
          current_price,
          product_url,
          price_history (
            id,
            price,
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
            stores (
              id,
              name,
              country,
              city
            )
          )
        `
        )
        .ilike("name", `%${query}%`);

      if (error) {
        console.error("Error searching products:", error);
        return;
      }

      // Map products and mark which have available stores for user's location
      const productsWithAvailability = (data as unknown as Product[]).map(
        (product) => {
          const availablePriceHistory = product.price_history?.filter((ph) => {
            const store = Array.isArray(ph.stores) ? ph.stores[0] : ph.stores;
            return store
              ? canStoreServeUser(store, userLocation, ph.fulfillment_type)
              : false;
          });

          return {
            ...product,
            price_history: availablePriceHistory,
            hasAvailableStores: (availablePriceHistory?.length || 0) > 0,
          };
        }
      );

      // Show all matching products, limit to 5
      const topResults = productsWithAvailability.slice(0, 5);

      setSuggestions(topResults);
      setIsOpen(true);
    };

    const debounce = setTimeout(searchProducts, 300);
    return () => clearTimeout(debounce);
  }, [query, userLocation, selectedProductName]);

  const handleSelectProduct = (product: Product) => {
    setQuery(product.name);
    setSelectedProductName(product.name);
    setIsOpen(false);
    setSuggestions([]);
    onProductSelect(product);
  };

  const handleClear = () => {
    setQuery("");
    setSuggestions([]);
    setIsOpen(false);
    setSelectedProductName("");
    onProductSelect(null);
  };

  return (
    <div className="relative mb-4 w-full">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() =>
            query.length >= 2 && suggestions.length > 0 && setIsOpen(true)
          }
          onBlur={() => {
            // Delay closing to allow click on suggestions
            setTimeout(() => setIsOpen(false), 200);
          }}
          placeholder="Search for products"
          className="w-full px-5 py-4 pr-10 border border-gray-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-gray-300 text-base text-gray-600 placeholder-gray-400"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((product) => (
            <button
              key={product.id}
              onClick={() => handleSelectProduct(product)}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
            >
              <div className="font-medium text-gray-900">{product.name}</div>
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {isOpen && query.length >= 2 && suggestions.length === 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4 text-sm text-gray-500">
          No products found matching &quot;{query}&quot;
        </div>
      )}
      <div className="mt-3 flex flex-row flex-wrap gap-1 items-center text-sm text-gray-600">
        <span>Showing final prices for</span>
        <span className="font-medium">
          📍{" "}
          {userLocation
            ? `${userLocation.city}, ${userLocation.country}`
            : "Loading..."}
        </span>
     
        <button
          onClick={onEditLocation}
          className="text-blue-600 hover:underline cursor-pointer"
        >
          Edit address
        </button>
      </div>
    </div>
  );
}
