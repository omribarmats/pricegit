import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

/**
 * Log an API call to the api_logs table.
 * Fire-and-forget — callers should NOT await this.
 * Failures are silently caught so logging never breaks API responses.
 */
export function logApiCall(
  endpoint: string,
  statusCode: number,
  durationMs: number,
  userId?: string | null,
  errorMessage?: string | null,
  metadata?: Record<string, unknown> | null,
): void {
  Promise.resolve(
    supabaseAdmin
      .from("api_logs")
      .insert({
        endpoint,
        status_code: statusCode,
        duration_ms: durationMs,
        user_id: userId || null,
        error_message: errorMessage || null,
        metadata: metadata || null,
      }),
  )
    .then(({ error }) => {
      if (error) {
        console.error("API logging error:", error.message);
      }
    })
    .catch(() => {
      // Silently ignore unexpected logging errors
    });
}
