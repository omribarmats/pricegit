import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit } from "@/lib/serverRateLimit";
import { getCorsHeaders } from "@/lib/cors";
import { logApiCall } from "@/lib/apiLogger";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
      logApiCall("analyze-screenshot", 401, Date.now() - startTime, null, "Authentication required");
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401, headers: corsHeaders },
      );
    }

    const token = authHeader.replace("Bearer ", "");
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

    const {
      data: { user },
      error: authError,
    } = await userSupabase.auth.getUser(token);

    if (authError || !user) {
      logApiCall("analyze-screenshot", 401, Date.now() - startTime, null, "Invalid or expired token");
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401, headers: corsHeaders },
      );
    }

    userId = user.id;

    // Check rate limit
    const rateLimit = await checkRateLimit(user.id, "analyze-screenshot");
    if (!rateLimit.allowed) {
      logApiCall("analyze-screenshot", 429, Date.now() - startTime, userId, "Rate limit exceeded");
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

    const { imageDataUrl, pageUrl, pageTitle } = await request.json();

    if (pageUrl && (typeof pageUrl !== "string" || pageUrl.length > 2000)) {
      return NextResponse.json(
        { error: "Page URL must be a string under 2000 characters" },
        { status: 400, headers: corsHeaders },
      );
    }
    if (pageTitle && (typeof pageTitle !== "string" || pageTitle.length > 500)) {
      return NextResponse.json(
        { error: "Page title must be a string under 500 characters" },
        { status: 400, headers: corsHeaders },
      );
    }

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

    const prompt = `Analyze this screenshot for price capture. First check if it's valid, then extract pricing information.

VALIDATION (Check these first):
1. Does this image contain ANY visible price (with currency symbol or number that looks like money)?
2. Does this image contain inappropriate content (violence, explicit content, hate speech, etc.)?

If NO PRICE is visible, set hasPrice to false and stop.
If INAPPROPRIATE CONTENT is detected, set isInappropriate to true with a reason.

PRICE BREAKDOWN (only if hasPrice is true):
- If you see separate prices (e.g., "Item: $50", "Delivery: $5", "Fees: $3"), extract them separately AND calculate the total
- If you only see a final total price, put it in totalPrice and leave itemPrice, shippingCost, fees as null
- If shipping/delivery is explicitly FREE or $0, set shippingCost to 0 (not null)
- If fees are explicitly $0 or waived, set fees to 0 (not null)
- Use null only when the information is not shown at all
- Always extract the most detailed breakdown available

Extract the following and return ONLY valid JSON with no additional text:

{
  "hasPrice": boolean (true if ANY price is visible in the image),
  "isInappropriate": boolean (true if image contains violent, explicit, or inappropriate content),
  "inappropriateReason": string | null (explain why if inappropriate),
  "itemPrice": number | null (base item price before shipping/fees, if shown separately),
  "shippingCost": number | null (delivery/shipping cost; use 0 if FREE/waived, null if not shown),
  "fees": number | null (taxes, handling fees, or other fees; use 0 if waived, null if not shown),
  "totalPrice": number | null (the FINAL/TOTAL price the customer pays),
  "currency": string (3-letter currency code like USD, EUR, GBP, ILS, JPY, etc.),
  "productName": string (the product name/title if visible),
  "isFinalPrice": boolean (true if totalPrice includes all costs, false if additional costs might apply)
}

Rules:
1. ALWAYS set hasPrice and isInappropriate first
2. If hasPrice is false, all price fields should be null
3. If breakdown is visible, extract each part separately
4. Calculate totalPrice by adding: itemPrice + shippingCost + fees (if breakdown exists)
5. All prices must be numbers (e.g., 99.99, not "$99.99")
6. If price has cents as superscript, combine them (e.g., 99⁹⁹ = 99.99)
7. currency must be an uppercase 3-letter ISO currency code
8. productName should be the main product title (empty string if none visible)

Page URL: ${pageUrl || "unknown"}
Page Title: ${pageTitle || "unknown"}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are a precise data extraction assistant specialized in e-commerce pricing. Analyze screenshots and extract pricing information. Return only valid JSON, no markdown formatting or additional text.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt,
            },
            {
              type: "image_url",
              image_url: {
                url: imageDataUrl,
                detail: "high",
              },
            },
          ],
        },
      ],
      temperature: 0,
      max_tokens: 500,
      response_format: { type: "json_object" },
    });

    const result = completion.choices[0].message.content;
    if (!result) {
      throw new Error("No response from OpenAI");
    }

    const extracted = JSON.parse(result);

    // Clean up product name - keep only first part before comma or descriptive words
    let cleanProductName = extracted.productName || "";
    if (cleanProductName) {
      cleanProductName = cleanProductName
        .split(/[,\-]|with|CMOS|K\/|fps|Vlog/i)[0]
        .trim();
    }

    // Validate and normalize the response
    const data = {
      hasPrice: Boolean(extracted.hasPrice),
      isInappropriate: Boolean(extracted.isInappropriate),
      inappropriateReason:
        typeof extracted.inappropriateReason === "string"
          ? extracted.inappropriateReason
          : null,
      itemPrice:
        typeof extracted.itemPrice === "number" ? extracted.itemPrice : null,
      shippingCost:
        typeof extracted.shippingCost === "number"
          ? extracted.shippingCost
          : null,
      fees: typeof extracted.fees === "number" ? extracted.fees : null,
      totalPrice:
        typeof extracted.totalPrice === "number" ? extracted.totalPrice : 0,
      basePrice:
        typeof extracted.totalPrice === "number" ? extracted.totalPrice : 0, // Keep for backward compatibility
      currency:
        typeof extracted.currency === "string"
          ? extracted.currency.toUpperCase()
          : "USD",
      productName: cleanProductName,
      isFinalPrice: Boolean(extracted.isFinalPrice),
    };

    logApiCall("analyze-screenshot", 200, Date.now() - startTime, userId, null, { externalApi: "openai" });
    return NextResponse.json(
      {
        success: true,
        data,
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error("Screenshot analysis error:", error);
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    logApiCall("analyze-screenshot", 500, Date.now() - startTime, userId, errorMsg, { externalApi: "openai" });
    return NextResponse.json(
      {
        success: false,
        error: "Failed to analyze screenshot",
        details: errorMsg,
      },
      { status: 500, headers: corsHeaders },
    );
  }
}
