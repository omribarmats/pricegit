import { UserLocation } from "@/types";

export async function getUserLocationFromIP(): Promise<UserLocation | null> {
  try {
    // Use ipapi.co for geolocation (free, no API key needed)
    const response = await fetch("https://ipapi.co/json/");
    const data = await response.json();

    if (data.country_name && data.city) {
      return {
        country: data.country_name,
        city: data.city,
        latitude: data.latitude,
        longitude: data.longitude,
      };
    }

    return null;
  } catch (error) {
    console.error("Error fetching user location:", error);
    return null;
  }
}

export function getStoredLocation(): UserLocation | null {
  if (typeof window === "undefined") return null;

  const stored = localStorage.getItem("userLocation");
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return null;
}

export function setStoredLocation(location: UserLocation): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("userLocation", JSON.stringify(location));
}

export function clearStoredLocation(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("userLocation");
}
