"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { UserLocation } from "@/types";
import {
  getStoredLocation,
  setStoredLocation,
  getUserLocationFromIP,
} from "@/lib/location";
import { LocationModal } from "@/components/LocationModal";

interface LocationContextValue {
  userLocation: UserLocation | null;
  setUserLocation: (location: UserLocation) => void;
  isLocationModalOpen: boolean;
  setIsLocationModalOpen: (open: boolean) => void;
  isLoadingLocation: boolean;
}

const LocationContext = createContext<LocationContextValue | null>(null);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [userLocation, setUserLocationState] = useState<UserLocation | null>(
    null,
  );
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);

  useEffect(() => {
    const initializeLocation = async () => {
      const stored = getStoredLocation();
      if (stored) {
        setUserLocationState(stored);
        setIsLoadingLocation(false);
        return;
      }

      const ipLocation = await getUserLocationFromIP();
      if (ipLocation) {
        setUserLocationState(ipLocation);
        setStoredLocation(ipLocation);
      } else {
        setIsLocationModalOpen(true);
      }
      setIsLoadingLocation(false);
    };

    initializeLocation();
  }, []);

  const setUserLocation = (location: UserLocation) => {
    setUserLocationState(location);
    setStoredLocation(location);
  };

  return (
    <LocationContext.Provider
      value={{
        userLocation,
        setUserLocation,
        isLocationModalOpen,
        setIsLocationModalOpen,
        isLoadingLocation,
      }}
    >
      {children}
      <LocationModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        onSave={setUserLocation}
        currentLocation={userLocation}
      />
    </LocationContext.Provider>
  );
}

export function useLocation(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) {
    throw new Error("useLocation must be used within a LocationProvider");
  }
  return ctx;
}
