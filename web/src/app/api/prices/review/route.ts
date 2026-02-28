import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logApiCall } from "@/lib/apiLogger";
import { checkRateLimit } from "@/lib/serverRateLimit";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let userId: string | null = null;
  try {
    // Check authentication via header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    
    // Create authenticated client with user's token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logApiCall("prices-review", 401, Date.now() - startTime, null, "Authentication required");
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    userId = user.id;

    // Check rate limit
    const rateLimit = await checkRateLimit(user.id, "prices-review");
    if (!rateLimit.allowed) {
      logApiCall("prices-review", 429, Date.now() - startTime, userId, "Rate limit exceeded");
      return NextResponse.json(
        {
          error: `Rate limit exceeded. Try again in ${Math.ceil(rateLimit.retryAfter / 60)} minutes`,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfter),
          },
        }
      );
    }

    const { priceId, action, rejectionReason } = await request.json();

    if (!priceId || !action) {
      return NextResponse.json(
        { error: "Missing required fields: priceId and action" },
        { status: 400 }
      );
    }

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'approve' or 'reject'" },
        { status: 400 }
      );
    }

    if (action === "reject" && !rejectionReason) {
      return NextResponse.json(
        { error: "Rejection reason is required when rejecting a price" },
        { status: 400 }
      );
    }

    // Fetch the price to check who submitted it
    const { data: price, error: fetchError } = await supabase
      .from("price_history")
      .select("id, submitted_by, status")
      .eq("id", priceId)
      .single();

    if (fetchError || !price) {
      return NextResponse.json({ error: "Price not found" }, { status: 404 });
    }

    // Prevent self-approval
    if (price.submitted_by === user.id) {
      return NextResponse.json(
        { error: "You cannot review your own price submission" },
        { status: 403 }
      );
    }

    // Check if already reviewed
    if (price.status !== "pending") {
      return NextResponse.json(
        { error: `This price has already been ${price.status}` },
        { status: 400 }
      );
    }

    // Update the price with review decision
    const updateData: {
      status: string;
      reviewed_by: string;
      reviewed_at: string;
      rejection_reason?: string;
    } = {
      status: action === "approve" ? "approved" : "rejected",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    };

    if (action === "reject") {
      updateData.rejection_reason = rejectionReason;
    }

    const { data: updatedPrice, error: updateError } = await supabase
      .from("price_history")
      .update(updateData)
      .eq("id", priceId)
      .select();

    if (updateError) {
      console.error("Update price error:", updateError);
      console.error("Update data:", updateData);
      console.error("Price ID:", priceId);
      console.error("User ID:", user.id);
      return NextResponse.json(
        {
          error: "Failed to update price status",
          details: updateError.message,
          code: updateError.code,
        },
        { status: 500 }
      );
    }

    if (!updatedPrice || updatedPrice.length === 0) {
      console.error("No rows updated - RLS policy may be blocking the update");
      return NextResponse.json(
        {
          error: "Failed to update price status",
          details:
            "No rows were updated. You may not have permission to review this price.",
        },
        { status: 403 }
      );
    }

    logApiCall("prices-review", 200, Date.now() - startTime, userId, null, { action, priceId });
    return NextResponse.json({
      success: true,
      price: updatedPrice[0],
      message: `Price ${
        action === "approve" ? "approved" : "rejected"
      } successfully`,
    });
  } catch (error) {
    console.error("Review price error:", error);
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    logApiCall("prices-review", 500, Date.now() - startTime, userId, errorMsg);
    return NextResponse.json(
      {
        error: "Failed to review price",
        details: errorMsg,
      },
      { status: 500 }
    );
  }
}
