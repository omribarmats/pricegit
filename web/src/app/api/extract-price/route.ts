import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Handle CORS preflight request
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
    const { html, url } = await request.json();

    if (!html || !url) {
      return NextResponse.json(
        { error: "Missing required fields: html and url" },
        {
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
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
4. productName should be the product title/name. Look for h1, product title, item name, etc. Return null ONLY if absolutely not found.
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
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: extracted,
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("Price extraction error:", error);
    return NextResponse.json(
      {
        error: "Failed to extract price information",
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
