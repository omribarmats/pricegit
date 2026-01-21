export interface Store {
  id: string;
  name: string;
  country: string;
  city: string | null;
  created_at: string;
  latitude?: number | null;
  longitude?: number | null;
  shipping_scope?: string | null;
  pricing_model?: string | null;
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
  fulfillment_type: "delivery" | "store" | "person";
  condition: "new" | "used";
  product_type: "physical" | "digital";
  currency?: string;
  is_final_price?: boolean;
  screenshot_url?: string | null;
  status?: "pending" | "approved" | "rejected";
  submitted_by?: string;
  stores?: Store | Store[];
  submitted_by_user?: { username: string } | { username: string }[];
}

export interface Product {
  id: string;
  name: string;
  image_url?: string;
  price_history: PriceHistory[];
  hasAvailableStores?: boolean; // Computed field for UI
}

export interface UserLocation {
  country: string;
  city: string;
  latitude: number;
  longitude: number;
}
