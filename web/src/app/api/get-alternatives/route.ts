import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders } from "@/lib/cors";
import { logApiCall } from "@/lib/apiLogger";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}

export async function POST(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);
  const startTime = Date.now();
  try {
    const { productName, productId, url, location } = await request.json();

    if ((!productName && !productId) || !location) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400, headers: corsHeaders }
      );
    }
    if (productName && (typeof productName !== "string" || productName.length > 500)) {
      return NextResponse.json(
        { error: "Product name must be a string under 500 characters" },
        { status: 400, headers: corsHeaders }
      );
    }
    if (productId && (typeof productId !== "string" || productId.length > 100)) {
      return NextResponse.json(
        { error: "Product ID must be a string under 100 characters" },
        { status: 400, headers: corsHeaders }
      );
    }
    if (location.country && (typeof location.country !== "string" || location.country.length > 100)) {
      return NextResponse.json(
        { error: "Country must be a string under 100 characters" },
        { status: 400, headers: corsHeaders }
      );
    }
    if (location.city && (typeof location.city !== "string" || location.city.length > 100)) {
      return NextResponse.json(
        { error: "City must be a string under 100 characters" },
        { status: 400, headers: corsHeaders }
      );
    }

    let query = supabase
      .from("price_history")
      .select(
        `
        id,
        price,
        source_url,
        captured_by_country,
        captured_by_city,
        created_at,
        fulfillment_type,
        condition,
        product_type,
        currency,
        is_final_price,
        submitted_by,
        products (
          id,
          name
        ),
        stores (
          id,
          name,
          country,
          city
        ),
        users:submitted_by (
          username
        )
      `
      )
      .eq("status", "approved"); // Only show approved prices

    // If productId, search by exact product
    if (productId) {
      query = query.eq("product_id", productId);
    } else {
      // Otherwise, search by product name (fuzzy match)
      // This requires joining with products table and filtering
      query = query.filter("products.name", "ilike", `%${productName}%`);
    }

    const { data: priceHistory, error } = await query
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("Get alternatives error:", error);
      return NextResponse.json(
        { error: "Failed to get alternatives" },
        {
          status: 500,
          headers: corsHeaders,
        }
      );
    }

    // Format alternatives and deduplicate by store + location + fulfillment + condition
    // (matching web app's getLatestPricePerStore logic)
    const priceMap = new Map();

    priceHistory?.forEach((item) => {
      const store = Array.isArray(item.stores) ? item.stores[0] : item.stores;
      const storeId = store?.id;

      if (!storeId) return;

      // Create composite key matching web app: store_id + country + city + fulfillment + condition
      const locationKey = item.captured_by_city
        ? `${storeId}:${item.captured_by_country}:${item.captured_by_city}:${item.fulfillment_type}:${item.condition}`
        : `${storeId}:${item.captured_by_country}:${item.fulfillment_type}:${item.condition}`;

      // Only keep the first entry for each unique combination (already sorted by created_at desc)
      if (!priceMap.has(locationKey)) {
        const product = Array.isArray(item.products)
          ? item.products[0]
          : item.products;
        const user = Array.isArray(item.users) ? item.users[0] : item.users;

        priceMap.set(locationKey, {
          id: item.id,
          price: item.price,
          total: item.price,
          currency: item.currency || "USD",
          store_name: store?.name || "Unknown",
          store_country: store?.country,
          store_city: store?.city,
          captured_by_country: item.captured_by_country,
          captured_by_city: item.captured_by_city,
          fulfillment_type: item.fulfillment_type,
          condition: item.condition,
          is_final_price: item.is_final_price,
          source_url: item.source_url,
          created_at: item.created_at,
          product_name: product?.name,
          submitted_by_username: user?.username || null,
        });
      }
    });

    const alternatives = Array.from(priceMap.values()) as Array<{
      price: number;
      [key: string]: unknown;
    }>;

    // Sort by price (cheapest first)
    alternatives.sort((a, b) => a.price - b.price);

    logApiCall("get-alternatives", 200, Date.now() - startTime);
    return NextResponse.json(
      {
        success: true,
        alternatives: alternatives,
      },
      {
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("Get alternatives error:", error);
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    logApiCall("get-alternatives", 500, Date.now() - startTime, null, errorMsg);
    return NextResponse.json(
      {
        error: "Failed to get alternatives",
        details: errorMsg,
      },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}
