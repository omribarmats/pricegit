import { NextRequest, NextResponse } from "next/server";

// Rate limiting: Track requests per IP
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Configuration
const RATE_LIMIT = {
  MAX_REQUESTS: 50, // Max requests per window
  WINDOW_MS: 60 * 60 * 1000, // 1 hour window
};

function getRateLimitKey(req: NextRequest): string {
  // Get IP from various headers (handles proxies)
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const ip = forwarded?.split(",")[0] || realIp || "unknown";
  return ip;
}

function checkRateLimit(key: string): {
  allowed: boolean;
  remaining: number;
  resetTime: number;
} {
  const now = Date.now();
  const record = rateLimitMap.get(key);

  // If no record or window expired, create new record
  if (!record || now > record.resetTime) {
    const resetTime = now + RATE_LIMIT.WINDOW_MS;
    rateLimitMap.set(key, { count: 1, resetTime });
    return { allowed: true, remaining: RATE_LIMIT.MAX_REQUESTS - 1, resetTime };
  }

  // Check if limit exceeded
  if (record.count >= RATE_LIMIT.MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetTime: record.resetTime };
  }

  // Increment count
  record.count++;
  return {
    allowed: true,
    remaining: RATE_LIMIT.MAX_REQUESTS - record.count,
    resetTime: record.resetTime,
  };
}

// Clean up old entries periodically (prevent memory leak)
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000); // Clean every 5 minutes

export async function GET(req: NextRequest) {
  try {
    // Get search query from URL params
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get("q");

    // Validate query
    if (!query || query.length < 2) {
      return NextResponse.json(
        { error: "Query must be at least 2 characters" },
        { status: 400 }
      );
    }

    // Check rate limit
    const rateLimitKey = getRateLimitKey(req);
    const rateLimit = checkRateLimit(rateLimitKey);

    if (!rateLimit.allowed) {
      const resetDate = new Date(rateLimit.resetTime);
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: `Too many requests. Try again after ${resetDate.toLocaleTimeString()}`,
          resetTime: rateLimit.resetTime,
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": RATE_LIMIT.MAX_REQUESTS.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": rateLimit.resetTime.toString(),
            "Retry-After": Math.ceil(
              (rateLimit.resetTime - Date.now()) / 1000
            ).toString(),
          },
        }
      );
    }

    // Get Mapbox token (server-side only, not exposed to client)
    const mapboxToken = process.env.MAPBOX_TOKEN;
    if (!mapboxToken) {
      console.error("MAPBOX_TOKEN not configured in environment variables");
      return NextResponse.json(
        { error: "Geocoding service not configured" },
        { status: 500 }
      );
    }

    // Call Mapbox API
    const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      query
    )}.json?access_token=${mapboxToken}&types=place,locality,address&limit=5`;

    const response = await fetch(mapboxUrl);

    if (!response.ok) {
      throw new Error(`Mapbox API error: ${response.statusText}`);
    }

    const data = await response.json();

    // Return results with rate limit headers
    return NextResponse.json(data, {
      status: 200,
      headers: {
        "X-RateLimit-Limit": RATE_LIMIT.MAX_REQUESTS.toString(),
        "X-RateLimit-Remaining": rateLimit.remaining.toString(),
        "X-RateLimit-Reset": rateLimit.resetTime.toString(),
      },
    });
  } catch (error) {
    console.error("Geocoding API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch location suggestions" },
      { status: 500 }
    );
  }
}
