import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/cors";
import { logApiCall } from "@/lib/apiLogger";
import { checkRateLimitByIp } from "@/lib/serverRateLimit";

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}

export async function GET(req: NextRequest) {
  const corsHeaders = getCorsHeaders(req);
  const startTime = Date.now();
  try {
    const searchParams = req.nextUrl.searchParams;
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");

    if (!lat || !lng) {
      return NextResponse.json(
        { error: "Missing lat or lng parameter" },
        { status: 400, headers: corsHeaders }
      );
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      return NextResponse.json(
        { error: "Invalid lat or lng value" },
        { status: 400, headers: corsHeaders },
      );
    }

    // Check rate limit (IP-based for unauthenticated endpoint)
    const rateLimit = await checkRateLimitByIp(req, "reverse-geocode");
    if (!rateLimit.allowed) {
      logApiCall("reverse-geocode", 429, Date.now() - startTime, null, "Rate limit exceeded");
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: `Too many requests. Try again in ${Math.ceil(rateLimit.retryAfter / 60)} minutes`,
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

    const mapboxToken = process.env.MAPBOX_TOKEN;
    if (!mapboxToken) {
      return NextResponse.json(
        { error: "Geocoding service not configured" },
        { status: 500, headers: corsHeaders }
      );
    }

    // Call Mapbox Reverse Geocoding API
    const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${mapboxToken}&types=place,locality,region,country&limit=1`;

    const response = await fetch(mapboxUrl);

    if (!response.ok) {
      throw new Error(`Mapbox API error: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.features || data.features.length === 0) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    const feature = data.features[0];
    const context = feature.context || [];

    // Extract city and country from context
    let city = "";
    let country = "";

    // The place_name usually contains the full address
    // Context contains the hierarchy: place, region, country
    for (const item of context) {
      if (item.id.startsWith("place.") || item.id.startsWith("locality.")) {
        city = item.text;
      }
      if (item.id.startsWith("country.")) {
        country = item.text;
      }
    }

    // If city not in context, use the main feature text
    if (!city && feature.place_type?.includes("place")) {
      city = feature.text;
    }

    // Fallback: parse from place_name
    if (!city || !country) {
      const parts = feature.place_name?.split(", ") || [];
      if (parts.length >= 2) {
        if (!city) city = parts[0];
        if (!country) country = parts[parts.length - 1];
      }
    }

    logApiCall("reverse-geocode", 200, Date.now() - startTime, null, null, { externalApi: "mapbox" });
    return NextResponse.json(
      {
        success: true,
        data: {
          city: city || "Unknown",
          country: country || "Unknown",
          latitude,
          longitude,
          fullAddress: feature.place_name || `${latitude}, ${longitude}`,
        },
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    logApiCall("reverse-geocode", 500, Date.now() - startTime, null, errorMsg, { externalApi: "mapbox" });
    return NextResponse.json(
      { error: "Failed to reverse geocode location" },
      { status: 500, headers: corsHeaders }
    );
  }
}
