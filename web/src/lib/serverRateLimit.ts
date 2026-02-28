import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
  "analyze-screenshot": { max: 30, windowMs: 60 * 60 * 1000 }, // 30 per hour
  "extract-price": { max: 50, windowMs: 60 * 60 * 1000 }, // 50 per hour
  "save-price": { max: 100, windowMs: 60 * 60 * 1000 }, // 100 per hour
  "upload-screenshot": { max: 60, windowMs: 60 * 60 * 1000 }, // 60 per hour
  "prices-review": { max: 100, windowMs: 60 * 60 * 1000 }, // 100 per hour
  geocode: { max: 50, windowMs: 60 * 60 * 1000 }, // 50 per hour
  "reverse-geocode": { max: 50, windowMs: 60 * 60 * 1000 }, // 50 per hour
};

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number;
}

/**
 * Rate limit by IP address (for unauthenticated endpoints like geocode).
 * Uses the same database table but with IP as the user_id field.
 */
export async function checkRateLimitByIp(
  request: { headers: { get(name: string): string | null } },
  endpoint: string,
): Promise<RateLimitResult> {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const ip = forwarded?.split(",")[0]?.trim() || realIp || "unknown";
  return checkRateLimit(`ip:${ip}`, endpoint);
}

export async function checkRateLimit(
  userId: string,
  endpoint: string,
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[endpoint];
  if (!config) {
    return { allowed: true, remaining: Infinity, retryAfter: 0 };
  }

  try {
    const windowStart = new Date(Date.now() - config.windowMs);

    // Get the most recent rate limit record within the current window
    const { data: records, error } = await supabaseAdmin
      .from("api_rate_limits")
      .select("id, request_count, window_start")
      .eq("user_id", userId)
      .eq("endpoint", endpoint)
      .gte("window_start", windowStart.toISOString())
      .order("window_start", { ascending: false })
      .limit(1);

    if (error) {
      console.error("Rate limit check error:", error);
      // Fail open — don't block users due to infra issues
      return { allowed: true, remaining: config.max, retryAfter: 0 };
    }

    const record = records?.[0];

    if (!record) {
      // First request in this window — create a new record
      await supabaseAdmin.from("api_rate_limits").insert({
        user_id: userId,
        endpoint,
        request_count: 1,
        window_start: new Date().toISOString(),
      });
      return { allowed: true, remaining: config.max - 1, retryAfter: 0 };
    }

    if (record.request_count >= config.max) {
      // Rate limit exceeded
      const resetTime =
        new Date(record.window_start).getTime() + config.windowMs;
      const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
      return { allowed: false, remaining: 0, retryAfter: Math.max(retryAfter, 1) };
    }

    // Increment the count
    await supabaseAdmin
      .from("api_rate_limits")
      .update({ request_count: record.request_count + 1 })
      .eq("id", record.id);

    return {
      allowed: true,
      remaining: config.max - (record.request_count + 1),
      retryAfter: 0,
    };
  } catch (err) {
    console.error("Rate limit unexpected error:", err);
    // Fail open
    return { allowed: true, remaining: config.max, retryAfter: 0 };
  }
}
