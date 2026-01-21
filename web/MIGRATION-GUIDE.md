# Regional Pricing Implementation - Migration Guide

## Overview

This implementation adds support for location-based pricing, ensuring users only see prices captured by users in their region to avoid trust issues with different tax/shipping costs.

## Database Migration

### Step 1: Run the Migration SQL

In your Supabase SQL Editor, run the migration file: `migration-add-regional-pricing.sql`

This will:

- Add `pricing_model` column to `stores` table (global_fixed or regional_variable)
- Add `captured_by_country` and `captured_by_city` columns to `price_history` table
- Backfill existing price_history entries with store location data (temporary until real user data)
- Create index on `captured_by_country` for faster queries
- Mark Adobe and Spotify as `global_fixed` pricing

### Step 2: Verify the Changes

Check that the migration completed successfully:

```sql
-- Check stores table
SELECT name, pricing_model FROM stores LIMIT 5;

-- Check price_history table
SELECT source, captured_by_country, captured_by_city FROM price_history LIMIT 5;
```

## Code Changes (Already Applied)

The following files have been updated:

### 1. Type Definitions (`src/types/index.ts`)

- Added `pricing_model` to `Store` interface
- Added `captured_by_country` and `captured_by_city` to `PriceHistory` interface

### 2. Database Queries

- `src/components/SearchBar.tsx` - Updated to fetch new fields
- `src/components/HomePage.tsx` - Updated to fetch new fields

### 3. Business Logic (`src/components/ProductList.tsx`)

- Added regional filtering: users only see prices captured in their country
- Exception: `global_fixed` stores show all prices (digital products like Adobe, Spotify)
- Updated empty states to distinguish between:
  - No stores that can ship to user
  - Stores exist but no price data from user's country

### 4. UI Updates (`src/components/ProductList.tsx`)

- Added location notice at top: "Showing prices for [City, Country] including all taxes and shipping"
- Removed redundant pricing model badges (cleaner UX)
- Displays warning when price data exists but not for user's country
- Only shows fulfillment badges (🌍 International shipping, 📦 Local shipping, 🏪 In-store, ♻️ 2nd hand)

## How It Works

### For Regional Variable Pricing (Most Stores)

1. User from Tel Aviv searches for "Sony A7 IV"
2. System finds all price_history entries
3. Filters to only show prices where `captured_by_country = 'Israel'`
4. Displays only those prices (ensuring they reflect Israel's taxes/shipping)

### For Global Fixed Pricing (Digital Products)

1. User from Tel Aviv searches for "Adobe Photoshop"
2. System finds Adobe Global store with `pricing_model = 'global_fixed'`
3. Shows all prices regardless of `captured_by_country` (price is same worldwide)
4. Currency conversion happens for display consistency

## Testing

### Test Case 1: Location Notice

1. Search for any product
2. Verify you see "Showing prices for [Your City, Your Country] including all taxes and shipping" at the top
3. Confirm only fulfillment badges appear (no pricing model badges)

### Test Case 2: Regional Variable Store

1. Search for a physical product (e.g., "Sony A7 IV")
2. Check that you only see prices from your country
3. Verify fulfillment badges show correctly

### Test Case 3: Global Fixed Store

1. Search for a digital product (e.g., "Adobe Photoshop")
2. Verify prices display regardless of where they were captured
3. No special "worldwide" badge should appear (all prices are already filtered to be relevant)

### Test Case 4: No Regional Data

1. Change your location to a country with no price data
2. Verify you see the yellow warning: "No price data for [Country]"
3. Check that the message explains why

## Future: Browser Extension Integration

When the browser extension is implemented, it should:

1. **Capture User Location**

   - Get user's country from IP or browser geolocation
   - Store in extension settings

2. **When User Captures a Price**

   - Send to API with:
     ```json
     {
       "product_id": "...",
       "store_id": "...",
       "price": 2548.0,
       "currency": "USD",
       "captured_by_country": "Israel",
       "captured_by_city": "Tel Aviv",
       "source": "B&H Photo",
       "source_url": "https://..."
     }
     ```

3. **Price Validation**
   - Extension shows user: "You will submit this as Israel pricing"
   - Warns if they're using VPN (might show wrong regional price)

## Key Benefits

✅ **Trust**: Users see prices accurate for their location (taxes, shipping included)
✅ **No Misleading Data**: NYC prices won't show to Delhi users who would see different final costs
✅ **Clean UX**: Simple location notice instead of confusing technical badges on every price
✅ **Efficient**: Digital products only need ONE user to capture (global_fixed)
✅ **Accurate**: Physical products show region-specific final pricing

## Rollback Plan

If you need to rollback these changes:

```sql
-- Remove new columns
ALTER TABLE stores DROP COLUMN IF EXISTS pricing_model;
ALTER TABLE price_history DROP COLUMN IF EXISTS captured_by_country;
ALTER TABLE price_history DROP COLUMN IF EXISTS captured_by_city;
DROP INDEX IF EXISTS price_history_captured_by_country_idx;
```

Then revert the code changes by checking out the previous commit.
