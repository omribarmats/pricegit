# API Rate Limiting & Security

This project implements **comprehensive rate limiting** to protect against API abuse and unexpected costs from the Mapbox Geocoding API.

## Two-Layer Protection

### 1. Client-Side Rate Limiting

**Location:** `src/lib/rateLimit.ts`

**Limits:**

- **30 requests per hour** per browser session
- Tracked in localStorage
- Prevents excessive requests before they reach the server

**Features:**

- Immediate feedback to users
- No server round-trip needed
- Survives page refreshes
- Automatically resets after 1 hour

**User Experience:**

- User gets friendly error message with countdown timer
- Example: "Too many searches. Please wait 45 minutes before trying again."

### 2. Server-Side Rate Limiting

**Location:** `src/app/api/geocode/route.ts`

**Limits:**

- **50 requests per hour** per IP address
- Tracked in server memory (Map)
- Last line of defense against abuse

**Features:**

- IP-based tracking (handles proxies with X-Forwarded-For)
- HTTP 429 status code with Retry-After header
- Automatic cleanup of expired records (prevents memory leaks)
- Standard rate limit headers:
  - `X-RateLimit-Limit`: Total allowed requests
  - `X-RateLimit-Remaining`: Requests remaining in window
  - `X-RateLimit-Reset`: Unix timestamp when limit resets

**Security:**

- Mapbox token is server-side only (not exposed to client)
- Token stored as `MAPBOX_TOKEN` (without `NEXT_PUBLIC_` prefix)
- Client cannot access or steal the token

## How It Works

### Request Flow:

```
User types in search box
         ↓
Client-side debounce (300ms)
         ↓
Client-side rate limit check (localStorage)
         ↓ (if allowed)
API call to /api/geocode
         ↓
Server-side rate limit check (IP-based)
         ↓ (if allowed)
Mapbox API call
         ↓
Return results to client
```

### Rate Limit Responses:

**Client-Side Block:**

```
Error message shown in modal:
"Too many searches. Please wait 23 minutes before trying again.
(Resets at 3:45 PM)"
```

**Server-Side Block:**

```
HTTP 429 Too Many Requests
{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Try again after 3:45:00 PM",
  "resetTime": 1700235900000
}
```

## Protection Against Abuse

### Scenario 1: Token Theft

**Risk:** Someone finds your Mapbox token in browser DevTools and uses it

**Protection:**
✅ Token is server-side only (`MAPBOX_TOKEN`)  
✅ Not accessible from browser  
✅ Cannot be stolen from client-side code

### Scenario 2: Automated Bot Attacks

**Risk:** Bot makes thousands of requests to your API

**Protection:**
✅ Server-side IP rate limiting (50/hour)  
✅ Bot hits limit quickly and gets 429 errors  
✅ Legitimate users from different IPs unaffected

### Scenario 3: Single User Abuse

**Risk:** User refreshes page repeatedly or searches constantly

**Protection:**
✅ Client-side rate limiting (30/hour in localStorage)  
✅ Friendly error message prevents frustration  
✅ User knows when they can try again

### Scenario 4: Distributed Attack (Multiple IPs)

**Risk:** Attacker uses many IPs to bypass rate limits

**Protection:**
⚠️ Current implementation has per-IP limits  
💡 Additional protection available:

- Add CAPTCHA after X failed attempts
- Implement API key authentication for known users
- Use Cloudflare or similar CDN with DDoS protection
- Monitor Mapbox dashboard for unusual spikes

## Monitoring Usage

### Manual Monitoring:

1. Go to https://account.mapbox.com/
2. Check "Statistics" section
3. Review monthly usage graphs
4. Set calendar reminders to check weekly

### Server Logs:

The API route logs all requests to console. Monitor for:

- Unusual patterns (same IP repeatedly)
- Spike in 429 responses
- Errors from Mapbox API

### Future Enhancements:

- [ ] Add database logging of all geocode requests
- [ ] Create admin dashboard to view usage stats
- [ ] Email alerts when approaching 80% of free tier
- [ ] Integration with monitoring service (Sentry, Datadog, etc.)

## Configuration

### Adjusting Rate Limits

**Client-Side** (`src/lib/rateLimit.ts`):

```typescript
const CLIENT_RATE_LIMIT = {
  MAX_REQUESTS: 30, // Change this
  WINDOW_MS: 60 * 60 * 1000, // 1 hour (change this)
};
```

**Server-Side** (`src/app/api/geocode/route.ts`):

```typescript
const RATE_LIMIT = {
  MAX_REQUESTS: 50, // Change this
  WINDOW_MS: 60 * 60 * 1000, // 1 hour (change this)
};
```

### Recommended Settings by Use Case:

**Development:**

- Client: 100/hour
- Server: 200/hour

**Production (Small Site):**

- Client: 30/hour
- Server: 50/hour

**Production (High Traffic):**

- Client: 20/hour
- Server: 30/hour
- Consider upgrading to Mapbox paid tier

## Mapbox Free Tier Limits

- **100,000 requests/month** = 3,333 requests/day
- Current limits: 50 requests/hour/IP = 1,200 requests/day/IP
- Supports ~8 concurrent users at max rate
- More than enough for small-to-medium sites

## Cost Protection Strategies

### 1. URL Restrictions (Set in Mapbox Dashboard)

- Restrict token to your domain only
- Prevents external use of your token
- **Highly recommended!**

### 2. Token Rotation

- Create new tokens for each project
- Can revoke compromised tokens instantly
- Don't use "Default public token"

### 3. Budget Alerts

While Mapbox doesn't have built-in alerts, you can:

- Export usage data monthly
- Create spreadsheet to track trends
- Set phone/calendar reminders to check

### 4. Failsafe

If you're really worried about costs:

- Start with a separate Mapbox account just for this project
- Use a prepaid credit card with low limit
- Upgrade only when confident in traffic patterns

## Testing Rate Limits

### Test Client-Side Limit:

1. Open your app
2. Click "Edit address"
3. Search 30+ times rapidly
4. Should see error message on 31st search

### Test Server-Side Limit:

```bash
# Make 51 requests quickly
for i in {1..51}; do
  curl "http://localhost:3000/api/geocode?q=test" &
done
```

Should receive 429 error on requests 51+.

### Reset Rate Limit (Testing Only):

```javascript
// In browser console:
localStorage.removeItem("geocode_rate_limit");
```

## Summary

✅ **Client-side rate limiting** prevents excessive requests  
✅ **Server-side rate limiting** protects your API  
✅ **Token hidden on server** prevents theft  
✅ **Debouncing** reduces unnecessary calls  
✅ **IP-based tracking** handles shared networks  
✅ **Graceful error messages** improve UX  
✅ **Memory leak prevention** with cleanup intervals  
✅ **Standard HTTP headers** for transparency

Your Mapbox API is now **secure and protected** from abuse! 🔒
