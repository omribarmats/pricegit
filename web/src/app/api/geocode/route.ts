import { NextRequest, NextResponse } from "next/server";
import { logApiCall } from "@/lib/apiLogger";
import { checkRateLimitByIp } from "@/lib/serverRateLimit";

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  try {
    // Get search query from URL params
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get("q");

    // Validate query
    if (!query || query.length < 2) {
      return NextResponse.json(
        { error: "Query must be at least 2 characters" },
        { status: 400 },
      );
    }

    // Check rate limit (IP-based for unauthenticated endpoint)
    const rateLimit = await checkRateLimitByIp(req, "geocode");

    if (!rateLimit.allowed) {
      logApiCall(
        "geocode",
        429,
        Date.now() - startTime,
        null,
        "Rate limit exceeded",
      );
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: `Too many requests. Try again in ${Math.ceil(rateLimit.retryAfter / 60)} minutes`,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfter),
          },
        },
      );
    }

    // Get Mapbox token (server-side only, not exposed to client)
    const mapboxToken = process.env.MAPBOX_TOKEN;
    if (!mapboxToken) {
      return NextResponse.json(
        { error: "Geocoding service not configured" },
        { status: 500 },
      );
    }

    // Call Mapbox API
    const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      query,
    )}.json?access_token=${mapboxToken}&types=place,locality,address&limit=5`;

    const response = await fetch(mapboxUrl);

    if (!response.ok) {
      throw new Error(`Mapbox API error: ${response.statusText}`);
    }

    const data = await response.json();

    logApiCall("geocode", 200, Date.now() - startTime, null, null, {
      externalApi: "mapbox",
    });
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    logApiCall("geocode", 500, Date.now() - startTime, null, errorMsg, {
      externalApi: "mapbox",
    });
    return NextResponse.json(
      { error: "Failed to fetch location suggestions" },
      { status: 500 },
    );
  }
}
