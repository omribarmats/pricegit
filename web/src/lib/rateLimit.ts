// Client-side rate limiting utilities
// Prevents abuse even before reaching the server

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const STORAGE_KEY = "geocode_rate_limit";

// Client-side limits (more lenient than server)
const CLIENT_RATE_LIMIT = {
  MAX_REQUESTS: 30, // Max requests per window
  WINDOW_MS: 60 * 60 * 1000, // 1 hour window
};

/**
 * Check if the user has exceeded client-side rate limit
 * @returns Object with allowed status, remaining requests, and reset time
 */
export function checkClientRateLimit(): {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  message?: string;
} {
  try {
    const now = Date.now();
    const stored = localStorage.getItem(STORAGE_KEY);
    const record: RateLimitRecord = stored
      ? JSON.parse(stored)
      : { count: 0, resetTime: now + CLIENT_RATE_LIMIT.WINDOW_MS };

    // If window expired, reset
    if (now > record.resetTime) {
      const newRecord = {
        count: 1,
        resetTime: now + CLIENT_RATE_LIMIT.WINDOW_MS,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newRecord));
      return {
        allowed: true,
        remaining: CLIENT_RATE_LIMIT.MAX_REQUESTS - 1,
        resetTime: newRecord.resetTime,
      };
    }

    // Check if limit exceeded
    if (record.count >= CLIENT_RATE_LIMIT.MAX_REQUESTS) {
      const resetDate = new Date(record.resetTime);
      const minutesRemaining = Math.ceil(
        (record.resetTime - now) / (60 * 1000)
      );
      return {
        allowed: false,
        remaining: 0,
        resetTime: record.resetTime,
        message: `Too many searches. Please wait ${minutesRemaining} minute${
          minutesRemaining !== 1 ? "s" : ""
        } before trying again. (Resets at ${resetDate.toLocaleTimeString()})`,
      };
    }

    // Increment count
    record.count++;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));

    return {
      allowed: true,
      remaining: CLIENT_RATE_LIMIT.MAX_REQUESTS - record.count,
      resetTime: record.resetTime,
    };
  } catch (error) {
    // If localStorage fails (privacy mode, etc.), allow the request
    console.warn("Client rate limit check failed:", error);
    return {
      allowed: true,
      remaining: CLIENT_RATE_LIMIT.MAX_REQUESTS,
      resetTime: Date.now() + CLIENT_RATE_LIMIT.WINDOW_MS,
    };
  }
}

/**
 * Reset the client-side rate limit (use sparingly, for testing only)
 */
export function resetClientRateLimit(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn("Failed to reset rate limit:", error);
  }
}

/**
 * Get current rate limit status without incrementing
 */
export function getClientRateLimitStatus(): {
  used: number;
  remaining: number;
  resetTime: number;
} {
  try {
    const now = Date.now();
    const stored = localStorage.getItem(STORAGE_KEY);

    if (!stored) {
      return {
        used: 0,
        remaining: CLIENT_RATE_LIMIT.MAX_REQUESTS,
        resetTime: now + CLIENT_RATE_LIMIT.WINDOW_MS,
      };
    }

    const record: RateLimitRecord = JSON.parse(stored);

    // If expired
    if (now > record.resetTime) {
      return {
        used: 0,
        remaining: CLIENT_RATE_LIMIT.MAX_REQUESTS,
        resetTime: now + CLIENT_RATE_LIMIT.WINDOW_MS,
      };
    }

    return {
      used: record.count,
      remaining: Math.max(0, CLIENT_RATE_LIMIT.MAX_REQUESTS - record.count),
      resetTime: record.resetTime,
    };
  } catch {
    return {
      used: 0,
      remaining: CLIENT_RATE_LIMIT.MAX_REQUESTS,
      resetTime: Date.now() + CLIENT_RATE_LIMIT.WINDOW_MS,
    };
  }
}
