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
    const { query } = await request.json();

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Missing query parameter" },
        { status: 400, headers: corsHeaders }
      );
    }

    const trimmedQuery = query.trim();
    if (trimmedQuery.length === 0 || trimmedQuery.length > 200) {
      return NextResponse.json(
        { error: "Query must be between 1 and 200 characters" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Use PostgreSQL trigram fuzzy search for better matching
    // This handles typos, word order, abbreviations, etc.
    const { data: products, error } = await supabase.rpc(
      "search_products_fuzzy",
      {
        search_query: query,
      }
    );

    if (error) {
      console.error("Product search error:", error);
      logApiCall("search-product", 500, Date.now() - startTime, null, "Failed to search products");
      return NextResponse.json(
        { error: "Failed to search products" },
        {
          status: 500,
          headers: corsHeaders,
        }
      );
    }

    logApiCall("search-product", 200, Date.now() - startTime);
    return NextResponse.json(
      {
        success: true,
        products: products || [],
      },
      {
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("Search product error:", error);
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    logApiCall("search-product", 500, Date.now() - startTime, null, errorMsg);
    return NextResponse.json(
      {
        error: "Failed to search products",
        details: errorMsg,
      },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}
