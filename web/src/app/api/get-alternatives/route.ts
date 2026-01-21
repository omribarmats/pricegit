import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const { productName, productId, url, location } = await request.json();

    console.log("Get alternatives request:", {
      productName,
      productId,
      location,
    });

    if ((!productName && !productId) || !location) {
      return NextResponse.json(
        { error: "Missing required fields" },
        {
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
        }
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
        products (
          id,
          name
        ),
        stores (
          id,
          name,
          country,
          city
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

    console.log("Price history results:", {
      count: priceHistory?.length || 0,
      data: priceHistory,
    });

    if (error) {
      console.error("Get alternatives error:", error);
      return NextResponse.json(
        { error: "Failed to get alternatives" },
        {
          status: 500,
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
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
        });
      }
    });

    const alternatives = Array.from(priceMap.values()) as Array<{
      price: number;
      [key: string]: unknown;
    }>;

    // Sort by price (cheapest first)
    alternatives.sort((a, b) => a.price - b.price);

    return NextResponse.json(
      {
        success: true,
        alternatives: alternatives,
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("Get alternatives error:", error);
    return NextResponse.json(
      {
        error: "Failed to get alternatives",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
}
