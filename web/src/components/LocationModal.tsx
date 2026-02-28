"use client";

import { useState, useRef, useEffect } from "react";
import { UserLocation } from "@/types";

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (location: UserLocation) => void;
  currentLocation: UserLocation | null;
}

interface MapboxSuggestion {
  place_name: string;
  center: [number, number]; // [longitude, latitude]
  context?: Array<{ id: string; text: string }>;
}

export function LocationModal({
  isOpen,
  onClose,
  onSave,
  currentLocation,
}: LocationModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<MapboxSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<{
    country: string;
    city: string;
    latitude: number;
    longitude: number;
  } | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    if (currentLocation) {
      setSearchQuery(`${currentLocation.city}, ${currentLocation.country}`);
      setSelectedLocation(currentLocation);
    }
  }, [currentLocation]);

  const searchAddress = async (query: string) => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      // Call our proxy API instead of Mapbox directly
      const response = await fetch(
        `/api/geocode?q=${encodeURIComponent(query)}`,
      );

      if (response.status === 429) {
        const data = await response.json();
        setErrorMessage(
          data.message || "Rate limit exceeded. Please try again later.",
        );
        setSuggestions([]);
        return;
      }

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();
      setSuggestions(data.features || []);
    } catch (error) {
      console.error("Error fetching address suggestions:", error);
      setErrorMessage(
        "Failed to fetch location suggestions. Please try again.",
      );
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (value: string) => {
    setSearchQuery(value);
    setSelectedLocation(null);

    // Debounce the API call
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      searchAddress(value);
    }, 300);
  };

  const handleSelectSuggestion = (suggestion: MapboxSuggestion) => {
    const [longitude, latitude] = suggestion.center;

    // Extract city and country from the suggestion
    const parts = suggestion.place_name.split(", ");
    const city = parts[0];
    const country = parts[parts.length - 1];

    setSearchQuery(suggestion.place_name);
    setSelectedLocation({ country, city, latitude, longitude });
    setSuggestions([]);
  };

  const handleSave = () => {
    if (!selectedLocation) return;

    onSave(selectedLocation);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Buffer zone around modal - clicks here won't close modal */}
      <div className="m-16 max-w-md w-full">
        <div className="bg-white rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Edit Location
            </h3>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl leading-none cursor-pointer"
            >
              ×
            </button>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search for your address or city
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder="e.g., Tel Aviv, Israel or 123 Main St, New York"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoComplete="off"
              />

              {/* Suggestions dropdown */}
              {suggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSelectSuggestion(suggestion)}
                      className="w-full px-3 py-2 text-left hover:bg-gray-100 border-b last:border-b-0 cursor-pointer"
                    >
                      <div className="text-sm text-gray-900">
                        {suggestion.place_name}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Loading indicator */}
              {isLoading && (
                <div className="absolute right-3 top-9 text-gray-400 text-sm">
                  Searching...
                </div>
              )}

              {/* Error message */}
              {errorMessage && (
                <div className="absolute z-10 w-full mt-1 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {errorMessage}
                </div>
              )}
            </div>

            {/* Show selected location details */}
            {selectedLocation && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="text-sm font-medium text-blue-900">
                  Selected Location:
                </div>
                <div className="text-sm text-blue-700 mt-1">
                  {selectedLocation.city}, {selectedLocation.country}
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSave}
                disabled={!selectedLocation}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                Save Location
              </button>
              <button
                onClick={onClose}
                className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
