import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit } from "@/lib/serverRateLimit";
import { getCorsHeaders } from "@/lib/cors";
import { logApiCall } from "@/lib/apiLogger";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Handle CORS preflight request
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
      logApiCall("extract-price", 401, Date.now() - startTime, null, "Authentication required");
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
      logApiCall("extract-price", 401, Date.now() - startTime, null, "Invalid or expired token");
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401, headers: corsHeaders },
      );
    }

    userId = user.id;

    // Check rate limit
    const rateLimit = await checkRateLimit(user.id, "extract-price");
    if (!rateLimit.allowed) {
      logApiCall("extract-price", 429, Date.now() - startTime, userId, "Rate limit exceeded");
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

    let { html, url } = await request.json();

    if (!html || !url) {
      return NextResponse.json(
        { error: "Missing required fields: html and url" },
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    // Input validation
    if (typeof html !== "string" || typeof url !== "string") {
      return NextResponse.json(
        { error: "html and url must be strings" },
        { status: 400, headers: corsHeaders },
      );
    }
    if (url.length > 2000) {
      return NextResponse.json(
        { error: "URL too long. Maximum 2000 characters." },
        { status: 400, headers: corsHeaders },
      );
    }
    // Truncate HTML to 500KB to limit OpenAI token costs
    if (html.length > 500000) {
      html = html.substring(0, 500000);
    }

    const prompt = `You are extracting e-commerce product information from HTML. 

Extract the following information and return ONLY valid JSON with no additional text:

{
  "basePrice": number (numeric value only, no currency symbols),
  "currency": string (3-letter currency code like USD, EUR, ILS),
  "productName": string or null,
  "storeName": string,
  "userRegion": string or null (country/region where user is shopping - check for "Deliver to", "Ship to", location selectors in HTML)
}

Rules:
1. basePrice must be a number (e.g., 180.99, not "180.99" or "$180.99")
2. If price has cents displayed as superscript, combine them (e.g., 180⁹⁹ = 180.99)
3. currency must be uppercase 3-letter code
4. productName should be SHORT and clean - ONLY brand + model name (e.g., "DJI Osmo Pocket 3", "iPhone 15 Pro", "Sony WH-1000XM5"). Do NOT include marketing descriptions, features, or specifications. Return null ONLY if absolutely not found.
5. For userRegion, look for shipping/delivery location indicators in the HTML first
6. If userRegion not found in HTML, return null
7. storeName should be the marketplace name (Amazon, eBay, etc.)

Page URL: ${url}

HTML:
${html}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a precise data extraction assistant. Return only valid JSON, no markdown formatting or additional text.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0,
      response_format: { type: "json_object" },
    });

    const result = completion.choices[0].message.content;
    if (!result) {
      throw new Error("No response from OpenAI");
    }

    const extracted = JSON.parse(result);

    // Clean up product name - keep only first part before comma or descriptive words
    if (extracted.productName) {
      const cleanName = extracted.productName
        .split(/[,\-]|with|CMOS|K\/|fps|Vlog/i)[0]
        .trim();
      extracted.productName = cleanName;
    }

    // Validate required fields (allow productName to be null - extension will retry with more HTML)
    if (
      typeof extracted.basePrice !== "number" ||
      !extracted.currency ||
      !extracted.storeName
    ) {
      return NextResponse.json(
        { error: "Invalid extraction result", details: extracted },
        {
          status: 500,
          headers: corsHeaders,
        }
      );
    }

    logApiCall("extract-price", 200, Date.now() - startTime, userId, null, { externalApi: "openai" });
    return NextResponse.json(
      {
        success: true,
        data: extracted,
      },
      {
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("Price extraction error:", error);
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    logApiCall("extract-price", 500, Date.now() - startTime, userId, errorMsg, { externalApi: "openai" });
    return NextResponse.json(
      {
        error: "Failed to extract price information",
        details: errorMsg,
      },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}
