import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders } from "@/lib/cors";
import { logApiCall } from "@/lib/apiLogger";
import { checkRateLimit } from "@/lib/serverRateLimit";

// Service role client for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
  let userId: string | null = null;
  try {
    // Check authentication
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      logApiCall("save-price", 401, Date.now() - startTime, null, "Authentication required");
      return NextResponse.json(
        { error: "Authentication required" },
        {
          status: 401,
          headers: corsHeaders,
        },
      );
    }

    // Verify the user's token
    const token = authHeader.replace("Bearer ", "");

    // Create a Supabase client with the user's token for validation
    const userSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      },
    );

    // Verify user authentication
    const {
      data: { user },
      error: authError,
    } = await userSupabase.auth.getUser(token);

    if (authError || !user) {
      console.error("Auth error:", authError);
      logApiCall("save-price", 401, Date.now() - startTime, null, "Invalid or expired token");
      return NextResponse.json(
        { error: "Invalid or expired token" },
        {
          status: 401,
          headers: corsHeaders,
        },
      );
    }

    userId = user.id;

    // Check rate limit
    const rateLimit = await checkRateLimit(user.id, "save-price");
    if (!rateLimit.allowed) {
      logApiCall("save-price", 429, Date.now() - startTime, userId, "Rate limit exceeded");
      return NextResponse.json(
        {
          error: `Rate limit exceeded. Try again in ${Math.ceil(rateLimit.retryAfter / 60)} minutes`,
        },
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Retry-After": String(rateLimit.retryAfter),
          },
        },
      );
    }

    const {
      productName,
      productId,
      storeName,
      price,
      basePrice,
      shippingCost,
      fees,
      currency,
      url,
      location,
      captureLocation,
      isFinalPrice,
      screenshotUrl,
    } = await request.json();

    const { data: roleData } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();
    const userRole = roleData?.role || "user";
    const autoApprove = userRole === "moderator" || userRole === "admin";

    if (!productName || !storeName || !price || !location) {
      return NextResponse.json(
        { error: "Missing required fields" },
        {
          status: 400,
          headers: corsHeaders,
        },
      );
    }

    // Input validation
    if (typeof price !== "number" || isNaN(price) || price <= 0 || price > 1000000) {
      return NextResponse.json(
        { error: "Price must be a number between 0 and 1,000,000" },
        { status: 400, headers: corsHeaders },
      );
    }
    if (basePrice != null && (typeof basePrice !== "number" || isNaN(basePrice) || basePrice < 0)) {
      return NextResponse.json(
        { error: "Base price must be a non-negative number" },
        { status: 400, headers: corsHeaders },
      );
    }
    if (shippingCost != null && (typeof shippingCost !== "number" || isNaN(shippingCost) || shippingCost < 0)) {
      return NextResponse.json(
        { error: "Shipping cost must be a non-negative number" },
        { status: 400, headers: corsHeaders },
      );
    }
    if (fees != null && (typeof fees !== "number" || isNaN(fees) || fees < 0)) {
      return NextResponse.json(
        { error: "Fees must be a non-negative number" },
        { status: 400, headers: corsHeaders },
      );
    }
    if (!currency || typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency)) {
      return NextResponse.json(
        { error: "Currency must be a 3-letter ISO code (e.g., USD, EUR, ILS)" },
        { status: 400, headers: corsHeaders },
      );
    }
    if (typeof productName !== "string" || productName.length > 500) {
      return NextResponse.json(
        { error: "Product name must be a string under 500 characters" },
        { status: 400, headers: corsHeaders },
      );
    }
    if (typeof storeName !== "string" || storeName.length > 200) {
      return NextResponse.json(
        { error: "Store name must be a string under 200 characters" },
        { status: 400, headers: corsHeaders },
      );
    }
    if (url && (typeof url !== "string" || url.length > 2000)) {
      return NextResponse.json(
        { error: "URL must be a string under 2000 characters" },
        { status: 400, headers: corsHeaders },
      );
    }
    if (!location.country || typeof location.country !== "string" || location.country.length > 100) {
      return NextResponse.json(
        { error: "location.country is required and must be under 100 characters" },
        { status: 400, headers: corsHeaders },
      );
    }

    // Duplicate submission check — prevent same user submitting same product+store within 24h
    if (productId) {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: existingSubmission } = await supabaseAdmin
        .from("price_history")
        .select("id")
        .eq("submitted_by", user.id)
        .eq("product_id", productId)
        .neq("status", "rejected")
        .gte("created_at", twentyFourHoursAgo)
        .limit(1);

      if (existingSubmission && existingSubmission.length > 0) {
        logApiCall("save-price", 409, Date.now() - startTime, userId, "Duplicate submission");
        return NextResponse.json(
          { error: "You already submitted a price for this product in the last 24 hours" },
          { status: 409, headers: corsHeaders },
        );
      }
    }

    let finalProductId = productId;

    // If no productId, create new product
    if (!productId) {
      const { data: newProduct, error: productError } = await supabaseAdmin
        .from("products")
        .insert({
          name: productName,
        })
        .select()
        .single();

      if (productError || !newProduct) {
        console.error("Create product error:", productError);
        logApiCall("save-price", 500, Date.now() - startTime, userId, "Failed to create product");
        return NextResponse.json(
          {
            error: "Failed to create product",
            details:
              productError?.message ||
              productError?.details ||
              "Unknown database error",
          },
          {
            status: 500,
            headers: corsHeaders,
          },
        );
      }

      finalProductId = newProduct.id;
    }

    // Find or create store
    const { data: existingStore } = await supabaseAdmin
      .from("stores")
      .select("id")
      .eq("name", storeName)
      .eq("country", location.country)
      .single();

    let storeId = existingStore?.id;

    if (!storeId) {
      const { data: newStore, error: storeError } = await supabaseAdmin
        .from("stores")
        .insert({
          name: storeName,
          country: location.country,
          city: location.city,
        })
        .select()
        .single();

      if (storeError || !newStore) {
        console.error("Create store error:", storeError);
        logApiCall("save-price", 500, Date.now() - startTime, userId, "Failed to create store");
        return NextResponse.json(
          {
            error: "Failed to create store",
            details:
              storeError?.message ||
              storeError?.details ||
              "Unknown database error",
          },
          {
            status: 500,
            headers: corsHeaders,
          },
        );
      }

      storeId = newStore.id;
    }

    // Save price history
    // Use captureLocation for captured_by fields if provided, otherwise fall back to location
    const captureData = captureLocation || location;

    const { data: priceHistory, error: priceError } = await supabaseAdmin
      .from("price_history")
      .insert({
        product_id: finalProductId,
        store_id: storeId,
        price: price,
        base_price: basePrice != null ? basePrice : null,
        shipping_cost: shippingCost != null ? shippingCost : null,
        fees: fees != null ? fees : null,
        source: "extension",
        source_url: url,
        captured_by_country: captureData.country,
        captured_by_city: captureData.city,
        delivery_country: location.country,
        delivery_city: location.city,
        fulfillment_type: "delivery",
        condition: "new",
        product_type: "physical",
        currency: currency,
        is_final_price: isFinalPrice ?? false,
        screenshot_url: screenshotUrl || null,
        submitted_by: user.id,
        status: autoApprove ? "approved" : "pending",
        reviewed_by: autoApprove ? user.id : null,
        reviewed_at: autoApprove ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (priceError) {
      console.error("Save price error:", priceError);
      logApiCall("save-price", 500, Date.now() - startTime, userId, "Failed to save price");
      return NextResponse.json(
        {
          error: "Failed to save price",
          details: priceError.message || priceError.details || "Unknown database error",
        },
        {
          status: 500,
          headers: corsHeaders,
        },
      );
    }

    logApiCall("save-price", 200, Date.now() - startTime, userId, null, { productId: finalProductId });
    return NextResponse.json(
      {
        success: true,
        productId: finalProductId,
        priceHistoryId: priceHistory.id,
      },
      {
        headers: corsHeaders,
      },
    );
  } catch (error) {
    console.error("Save price error:", error);
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    logApiCall("save-price", 500, Date.now() - startTime, userId, errorMsg);
    return NextResponse.json(
      {
        error: "Failed to save price",
        details: errorMsg,
      },
      {
        status: 500,
        headers: corsHeaders,
      },
    );
  }
}
