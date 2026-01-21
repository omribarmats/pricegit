import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// CORS headers for extension requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(request: NextRequest) {
  try {
    const { imageDataUrl } = await request.json();

    if (!imageDataUrl || !imageDataUrl.startsWith("data:image/")) {
      return NextResponse.json(
        { error: "Invalid image data" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Get user ID from auth token if available (optional for now)
    let userId = "anonymous";
    const authHeader = request.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        userId = user.id;
      }
    }

    // Convert base64 to buffer
    const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    // Generate unique filename using crypto
    const filename = `${crypto.randomUUID()}.png`;
    const filePath = `price-screenshots/${userId}/${filename}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("screenshots")
      .upload(filePath, buffer, {
        contentType: "image/png",
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload screenshot", details: uploadError.message },
        { status: 500, headers: corsHeaders }
      );
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from("screenshots")
      .getPublicUrl(filePath);

    return NextResponse.json(
      { success: true, screenshotUrl: publicUrl },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("Upload screenshot error:", error);
    return NextResponse.json(
      { error: "Failed to upload screenshot" },
      { status: 500, headers: corsHeaders }
    );
  }
}
