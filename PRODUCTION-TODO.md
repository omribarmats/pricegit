# Production Readiness TODO

## Priority 1: Must Fix Before Production

### [x] Security Hardening (Completed)
- [x] Authentication on AI endpoints (analyze-screenshot, extract-price)
- [x] Database-backed rate limiting (all authenticated endpoints)
- [x] Input validation across all API routes
- [x] CORS restricted to allowed origins
- [x] Security headers (HSTS, X-Frame-Options, etc.)
- [x] Duplicate submission detection (24hr window)
- [x] RLS policies tightened (no public INSERT)
- [x] API usage logging

### [x] Remove Debug Console Statements (Web App)
- [x] `web/src/app/page.tsx` — removed full query result logs
- [x] `web/src/components/Header.tsx` — removed "Sign out clicked" log
- [x] `web/src/contexts/AuthContext.tsx` — removed auth debug logs
- [x] `web/src/components/AuthForm.tsx` — removed auth flow debug logs
- Note: `console.error` in API routes is acceptable (captured by hosting platform logs)

### [x] Fix N+1 Query on Homepage
- [x] `web/src/app/page.tsx` — replaced 19-query loop with single joined query

### [x] Delete Legacy/Unnecessary Files
- [x] `extension-v2/popup-old.js` — deleted
- [x] `extension-v2/popup-old.html` — deleted
- [x] `extension-v2/popup-old.css` — deleted
- [ ] `web/migrations/add-test-pending-prices.sql` — test data, should not run in production

### [x] Delete Dev Documentation
- [x] `AUTH_IMPLEMENTATION.md` — deleted
- [x] `PENDING_PRICES_ISSUE.md` — deleted
- [x] `web/SECURITY-TODO.md` — deleted
- [x] `web/SEO-TODO.md` — deleted

### [x] Remove Commented-Out Code
- [x] `web/src/components/LocationModal.tsx` — removed disabled client-side rate limiting

### [x] Fix CORS Fallback
- [x] `web/src/lib/cors.ts` — now returns empty string for non-matching origins

### [x] Database-Backed Rate Limiting on Geocode Endpoints
- [x] `web/src/app/api/geocode/route.ts` — replaced in-memory Map() with database-backed IP rate limiting
- [x] `web/src/app/api/reverse-geocode/route.ts` — added database-backed IP rate limiting

### [x] Create .env.example
- [x] `web/.env.example` — documents all required environment variables

---

## Priority 2: Before Extension Publishing

### [ ] Replace Hardcoded localhost URLs in Extension
All API calls in the extension point to `http://localhost:3000/api/...`:
- [ ] `extension-v2/popup.js` — ~6 locations
- [ ] `extension-v2/background.js` — ~1 location
- [ ] `extension-v2/content/content.js` — ~6 locations
- Consider: use a config constant at the top of each file or a shared config

### [x] Remove Extension Console Statements
- [x] `extension-v2/background.js` — all debug logs removed
- [x] `extension-v2/popup.js` — all debug logs removed
- [x] `extension-v2/content/content.js` — all debug logs removed
- [x] `extension-v2/content/web-auth.js` — all debug logs removed

### [x] Fix Duplicate Function in popup.js
- [x] `showAuthRequiredModal()` duplicate definition removed

---

## Priority 3: Nice to Have / Future

### [ ] Structured Logging
- Replace remaining `console.error` calls in API routes with a proper logging service (Sentry, LogRocket, etc.)
- Currently acceptable since hosting platform captures console output

### [x] SEO (Done)
- [x] robots.ts — blocks /api/, /settings, /moderate, etc.
- [x] sitemap.ts — dynamic sitemap with all product pages
- [x] opengraph-image.tsx — dynamic OG images for product pages
- [x] Homepage metadata + JSON-LD schema
- [x] Product page metadata + JSON-LD Product/AggregateOffer schema
- [x] Canonical URLs
- [x] Removed `console.log` in opengraph-image.tsx
- [ ] Post-launch: monitor Google Search Console for issues
