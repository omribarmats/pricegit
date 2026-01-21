# Mapbox Address Autocomplete Setup

The location modal now uses Mapbox Geocoding API for intelligent address autocomplete instead of manual dropdown selection.

## Setup Steps

### 1. Create a Mapbox Account

1. Go to https://account.mapbox.com/
2. Sign up for a free account (no credit card required for the free tier)
3. Free tier includes: **100,000 requests per month**

### 2. Get Your Access Token

1. After signing in, go to https://account.mapbox.com/access-tokens/
2. You'll see a **Default public token** already created
3. Copy this token (starts with `pk.`)

### 3. Add Token to .env.local

Open `.env.local` and replace the placeholder:

```env
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_actual_token_here
```

## How It Works

### User Experience

1. User clicks **"Edit address"** button
2. Modal opens with a single search input
3. User types an address, city, or place (e.g., "Tel Aviv", "123 Main St, New York")
4. As they type, Mapbox returns **real-time suggestions**
5. User selects from the dropdown
6. Mapbox automatically provides:
   - City name
   - Country name
   - Exact latitude and longitude coordinates
7. Location is saved to localStorage

### Technical Details

- **API Endpoint**: `https://api.mapbox.com/geocoding/v5/mapbox.places/`
- **Debouncing**: 300ms delay before API call (prevents too many requests)
- **Search Types**: `place,locality,address` (cities, neighborhoods, addresses)
- **Limit**: 5 suggestions per search
- **Coordinates**: Returns [longitude, latitude] which we convert to our format

## Benefits Over Manual Selection

### Better UX

- Single search input instead of cascading dropdowns
- Type-ahead autocomplete feels modern and fast
- Supports full addresses, not just cities

### More Accurate

- Returns exact GPS coordinates automatically
- No need to manually look up lat/lon
- Handles variations in place names (e.g., "NYC" → "New York, United States")

### More Comprehensive

- Covers all countries and cities worldwide
- Includes neighborhoods and specific addresses
- Supports multiple languages

## Example Searches

Try these in the location modal:

- `Tel Aviv` → "Tel Aviv, Israel"
- `123 Dizengoff Street, Tel Aviv` → Exact address with coordinates
- `Manhattan` → "Manhattan, New York, United States"
- `Tokyo` → "Tokyo, Japan"
- `Paris 75001` → "Paris 75001, France" (with postal code)

## Free Tier Limits

- **100,000 requests/month** = ~3,333 requests/day
- Each keystroke after debounce = 1 request
- Typical user session uses 5-10 requests
- **More than enough** for development and small-to-medium production use

## Rate Limiting

The code includes:

- **Debouncing**: Waits 300ms after user stops typing before making API call
- **Minimum query length**: Requires at least 3 characters
- **Result limit**: Only requests 5 suggestions

These optimizations keep your request count low.

## Fallback Behavior

If Mapbox token is not configured or invalid:

- Console warning is logged
- Suggestions won't appear
- User can still type in the field manually
- No errors break the app

## Privacy & Security

- Token is public (starts with `pk.`)
- Safe to expose in client-side code
- Mapbox expects public tokens in browser apps
- Can restrict token to specific URLs in Mapbox dashboard

## Next Steps

Once configured, test by:

1. Run `npm run dev`
2. Click "Edit address" in the header
3. Start typing a city or address
4. Select from the suggestions
5. Verify coordinates are saved correctly
