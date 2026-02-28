import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders } from "@/lib/cors";
import { logApiCall } from "@/lib/apiLogger";
import { checkRateLimit } from "@/lib/serverRateLimit";

const supabase = createClient(
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
  let logUserId: string | null = null;
  try {
    const { imageDataUrl } = await request.json();

    if (!imageDataUrl || !imageDataUrl.startsWith("data:image/")) {
      return NextResponse.json(
        { error: "Invalid image data" },
        { status: 400, headers: corsHeaders },
      );
    }

    // Validate image size (5MB max)
    const base64Data = imageDataUrl.split(",")[1] || "";
    const sizeInBytes = (base64Data.length * 3) / 4;
    if (sizeInBytes > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Image too large. Maximum size is 5MB." },
        { status: 400, headers: corsHeaders },
      );
    }

    // Get user auth token (required for storage upload)
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401, headers: corsHeaders },
      );
    }

    const token = authHeader.replace("Bearer ", "");

    // Create supabase client with user's token for RLS
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

    // Verify user
    const {
      data: { user },
      error: authError,
    } = await userSupabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json(
        { error: "Invalid authentication token" },
        { status: 401, headers: corsHeaders },
      );
    }

    const userId = user.id;
    logUserId = userId;

    // Check rate limit
    const rateLimit = await checkRateLimit(userId, "upload-screenshot");
    if (!rateLimit.allowed) {
      logApiCall("upload-screenshot", 429, Date.now() - startTime, logUserId, "Rate limit exceeded");
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

    // Convert base64 to buffer (reuse base64Data from size validation above)
    const buffer = Buffer.from(base64Data, "base64");

    // Generate unique filename using crypto
    const filename = `${crypto.randomUUID()}.png`;
    const filePath = `price-screenshots/${userId}/${filename}`;

    // Upload to Supabase Storage using user's credentials
    const { error: uploadError } = await userSupabase.storage
      .from("screenshots")
      .upload(filePath, buffer, {
        contentType: "image/png",
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload screenshot", details: uploadError.message },
        { status: 500, headers: corsHeaders },
      );
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = userSupabase.storage.from("screenshots").getPublicUrl(filePath);

    logApiCall("upload-screenshot", 200, Date.now() - startTime, logUserId);
    return NextResponse.json(
      { success: true, screenshotUrl: publicUrl },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error("Upload screenshot error:", error);
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    logApiCall("upload-screenshot", 500, Date.now() - startTime, logUserId, errorMsg);
    return NextResponse.json(
      { error: "Failed to upload screenshot" },
      { status: 500, headers: corsHeaders },
    );
  }
}
