import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/cors";
import { logApiCall } from "@/lib/apiLogger";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, { headers: getCorsHeaders(request) });
}

export async function POST(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);
  const startTime = Date.now();
  try {
    const { url, country } = await request.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { success: false, error: "URL is required" },
        { status: 400, headers: corsHeaders }
      );
    }
    if (url.length > 2000) {
      return NextResponse.json(
        { success: false, error: "URL too long. Maximum 2000 characters." },
        { status: 400, headers: corsHeaders }
      );
    }
    if (country && (typeof country !== "string" || country.length > 100)) {
      return NextResponse.json(
        { success: false, error: "Country must be a string under 100 characters" },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log("Checking page for URL:", url, "Country:", country);

    // Query price_history for matching URLs
    // Look for entries where source_url contains parts of the current URL
    const { data: priceHistory, error } = await supabase
      .from("price_history")
      .select(
        `
        id,
        price,
        shipping_fee,
        other_fees,
        currency,
        source_url,
        captured_at,
        shipping_type,
        delivery_time,
        captured_by_country,
        product_id,
        products (
          id,
          name
        ),
        store_id,
        stores (
          id,
          name,
          country,
          shipping_scope
        )
      `
      )
      .ilike("source_url", `%${getUrlPattern(url)}%`);

    if (error) {
      console.error("Database error:", error);
      // Return empty results instead of 500 error
      return NextResponse.json(
        { success: true, alternatives: [], productName: null },
        { headers: corsHeaders }
      );
    }

    if (!priceHistory || priceHistory.length === 0) {
      return NextResponse.json(
        { success: true, alternatives: [], productName: null },
        { headers: corsHeaders }
      );
    }

    // Get product name from first result
    const productName = Array.isArray(priceHistory[0].products)
      ? (priceHistory[0].products[0] as { id: string; name: string })?.name
      : (priceHistory[0].products as { id: string; name: string } | null)?.name;

    const productId = priceHistory[0].product_id;

    // Get all prices for this product
    const { data: allPrices, error: pricesError } = await supabase
      .from("price_history")
      .select(
        `
        id,
        price,
        shipping_fee,
        other_fees,
        currency,
        source_url,
        captured_at,
        shipping_type,
        delivery_time,
        captured_by_country,
        stores (
          id,
          name,
          country,
          shipping_scope
        )
      `
      )
      .eq("product_id", productId);

    if (pricesError) {
      console.error("Error fetching all prices:", pricesError);
    }

    // Filter by country if provided
    let filteredPrices = allPrices || priceHistory;

    if (country) {
      filteredPrices = filteredPrices.filter((item) => {
        const store = Array.isArray(item.stores) ? item.stores[0] : item.stores;
        return (
          item.captured_by_country === country ||
          store?.country === country ||
          store?.shipping_scope === "international"
        );
      });
    }

    // Format alternatives
    const alternatives = filteredPrices.map((item) => {
      const store = Array.isArray(item.stores) ? item.stores[0] : item.stores;
      const total =
        item.price + (item.shipping_fee || 0) + (item.other_fees || 0);

      return {
        id: item.id,
        price: item.price,
        shipping_fee: item.shipping_fee,
        other_fees: item.other_fees,
        total: total.toFixed(2),
        currency: item.currency,
        store_name: store?.name || "Unknown Store",
        shipping_type: item.shipping_type || "local",
        delivery_time: item.delivery_time,
        source_url: item.source_url,
        captured_at: item.captured_at,
      };
    });

    logApiCall("check-page", 200, Date.now() - startTime);
    return NextResponse.json(
      {
        success: true,
        productName,
        productId,
        alternatives,
      },
      { headers: corsHeaders }
    );
  } catch (err) {
    console.error("Error in check-page:", err);
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    logApiCall("check-page", 500, Date.now() - startTime, null, errorMsg);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}

// Extract meaningful pattern from URL for matching
function getUrlPattern(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;

    // Extract product ID patterns
    // Amazon: /dp/B08XYZ or /gp/product/B08XYZ
    const amazonMatch = pathname.match(/\/(dp|gp\/product)\/([A-Z0-9]+)/);
    if (amazonMatch) return amazonMatch[2];

    // eBay: /itm/123456789
    const ebayMatch = pathname.match(/\/itm\/(\d+)/);
    if (ebayMatch) return ebayMatch[1];

    // Generic: last part of path
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length > 0) {
      return parts[parts.length - 1];
    }

    return pathname;
  } catch (error) {
    return url;
  }
}
