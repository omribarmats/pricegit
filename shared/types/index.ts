export interface Store {
  id: string;
  name: string;
  country: string;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  product_type: "physical" | "digital";
  fulfillment_type?: "shipping" | "in_store_only";
  shipping_scope?: "local" | "national" | "international" | "global";
  condition: "new" | "used";
  seller_type?: "retailer" | "private";
  currency?: string; // ISO currency code (USD, ILS, EUR, etc.)
  pricing_model: "global_fixed" | "regional_variable";
  local_radius_km?: number | null;
  shipping_countries?: string[] | null;
  available_countries?: string[] | null;
  created_at: string;
}

export interface PriceHistory {
  id: string;
  price: number;
  source: string;
  source_url: string;
  created_at: string;
  store_id: string;
  captured_by_country: string;
  captured_by_city?: string | null;
  stores?: Store;
  status?: "pending" | "approved" | "rejected";
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  submitted_by?: string | null;
}

export interface Product {
  id: string;
  name: string;
  current_price: number;
  product_url: string;
  price_history: PriceHistory[];
  hasAvailableStores?: boolean; // Computed field for UI
}

export interface UserLocation {
  country: string;
  city: string;
  latitude: number;
  longitude: number;
}
