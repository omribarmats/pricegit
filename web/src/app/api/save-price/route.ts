import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Use service role key for server-side operations to bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "Authentication required" },
        {
          status: 401,
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Verify the user's token
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        {
          status: 401,
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const {
      productName,
      productId,
      storeName,
      price,
      shipping,
      fees,
      currency,
      url,
      location,
      isFinalPrice,
    } = await request.json();

    if (!productName || !storeName || !price || !location) {
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

    let finalProductId = productId;

    // If no productId, create new product
    if (!productId) {
      const { data: newProduct, error: productError } = await supabase
        .from("products")
        .insert({
          name: productName,
        })
        .select()
        .single();

      if (productError || !newProduct) {
        console.error("Create product error:", productError);
        return NextResponse.json(
          { error: "Failed to create product" },
          {
            status: 500,
            headers: {
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }

      finalProductId = newProduct.id;
    }

    // Find or create store
    const { data: existingStore } = await supabase
      .from("stores")
      .select("id")
      .eq("name", storeName)
      .eq("country", location.country)
      .single();

    let storeId = existingStore?.id;

    if (!storeId) {
      const { data: newStore, error: storeError } = await supabase
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
        return NextResponse.json(
          { error: "Failed to create store" },
          {
            status: 500,
            headers: {
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }

      storeId = newStore.id;
    }

    // Save price history
    const { data: priceHistory, error: priceError } = await supabase
      .from("price_history")
      .insert({
        product_id: finalProductId,
        store_id: storeId,
        price: price,
        source: "extension",
        source_url: url,
        captured_by_country: location.country,
        captured_by_city: location.city,
        fulfillment_type: "delivery",
        condition: "new",
        product_type: "physical",
        currency: currency,
        is_final_price: isFinalPrice ?? false,
        submitted_by: user.id,
        status: "pending", // Requires peer review before appearing publicly
      })
      .select()
      .single();

    if (priceError) {
      console.error("Save price error:", priceError);
      return NextResponse.json(
        { error: "Failed to save price" },
        {
          status: 500,
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        productId: finalProductId,
        priceHistoryId: priceHistory.id,
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("Save price error:", error);
    return NextResponse.json(
      {
        error: "Failed to save price",
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
