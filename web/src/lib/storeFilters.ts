import { Store, UserLocation } from "@/types";

/**
 * Check if a store can serve a user based on location and fulfillment rules
 */
export function canStoreServeUser(
  store: Store,
  userLocation: UserLocation,
  fulfillmentType: "delivery" | "store" | "person"
): boolean {
  // For delivery - check if user's country matches store's country
  if (fulfillmentType === "delivery") {
    return store.country === userLocation.country;
  }

  // For store pickup or person-to-person, check if in same city
  if (fulfillmentType === "store" || fulfillmentType === "person") {
    return (
      store.country === userLocation.country && store.city === userLocation.city
    );
  }

  return false;
}

/**
 * Filter stores that can serve the user
 */
export function filterStoresByLocation(
  stores: Store[],
  userLocation: UserLocation,
  fulfillmentType: "delivery" | "store" | "person"
): Store[] {
  return stores.filter((store) =>
    canStoreServeUser(store, userLocation, fulfillmentType)
  );
}
