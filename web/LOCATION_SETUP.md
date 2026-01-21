# Price Listener - Location & Fulfillment Setup Guide

## Updated Database Schema

The database now includes sophisticated location-based filtering with fulfillment rules:

### Tables:

1. **stores** - Store locations with fulfillment capabilities
2. **products** - Product information
3. **price_history** - Price records linked to both products AND stores

## Store Fulfillment Types

### Physical Products

**In-Store Only:**

- Customer must visit physically
- Only shown if user is within `local_radius_km` (default: 30-50km)
- Example: Local camera shop, grocery store

**Shipping - Local:**

- Delivers within a radius
- Uses `local_radius_km` to determine coverage
- Example: Local bakery that delivers within 50km

**Shipping - National:**

- Ships within the entire country
- Only shown to users in the same country
- Example: Amazon Israel (ships anywhere in Israel)

**Shipping - International:**

- Ships to specific countries
- Uses `shipping_countries` array
- Example: B&H Photo (ships to US, Canada, Israel, UK, Germany)

**Shipping - Global:**

- Ships worldwide
- Always shown (except for cost considerations)
- Example: AliExpress

### Digital Products

**Region-Specific:**

- Uses `available_countries` array
- Example: Spotify Israel, Steam Regional pricing

**Global:**

- `available_countries` is NULL
- Available everywhere
- Example: Adobe Photoshop, global SaaS products

## How Location Filtering Works

### 1. User Location Detection

- IP-based geolocation captures: country, city, latitude, longitude
- Stored in localStorage
- User can manually override

### 2. Store Filtering Algorithm

**For Physical Products:**

```
if (in_store_only):
  → Show if distance ≤ local_radius_km

if (shipping && scope == 'local'):
  → Show if distance ≤ local_radius_km

if (shipping && scope == 'national'):
  → Show if user.country == store.country

if (shipping && scope == 'international'):
  → Show if user.country IN store.shipping_countries

if (shipping && scope == 'global'):
  → Always show
```

**For Digital Products:**

```
if (available_countries == null):
  → Show to everyone

if (available_countries has values):
  → Show if user.country IN available_countries
```

### 3. Product Display

- Only shows products with at least one available store
- If no stores can serve user → "This product is not available in your area"

## Sample Data Examples

Run the updated SQL to get:

**Tel Aviv, Israel user sees:**

- DJI Osmo 3 from:
  - Amazon Israel (national shipping) ✓
  - Cameras Online IL (local shipping, 50km) ✓
  - Local Camera Shop TLV (in-store, 30km) ✓
  - B&H Photo (ships to Israel) ✓
- Adobe Photoshop (digital, global) ✓
- Spotify (digital, global AND Israel-specific pricing) ✓

**New York, USA user sees:**

- DJI Osmo 3 from:
  - B&H Photo (international) ✓
- Sony A7 IV from:
  - Amazon US (national) ✓
  - B&H Photo (international) ✓
  - Best Buy NYC (in-store, 40km) ✓
- Adobe Photoshop (digital, global) ✓

**London, UK user sees:**

- DJI Osmo 3 from:
  - B&H Photo (ships to UK) ✓
- Adobe Photoshop (digital, global) ✓

## Setup Instructions

1. **Run the updated SQL** in Supabase SQL Editor
2. **Test location detection** - Visit site, should auto-detect your location
3. **Test manual location** - Click "Edit address" to change location
4. **Test filtering:**
   - Search "DJI Osmo 3" from different locations
   - Search "Adobe Photoshop" (should work everywhere)
   - Search "Sony A7 IV" (only US users see it)

## Adding New Stores

### Physical Store - National Shipping

```sql
insert into stores (name, country, city, latitude, longitude, product_type, fulfillment_type, shipping_scope)
values ('Amazon UK', 'United Kingdom', 'London', 51.5074, -0.1278, 'physical', 'shipping', 'national');
```

### Physical Store - In-Store Only

```sql
insert into stores (name, country, city, latitude, longitude, product_type, fulfillment_type, local_radius_km)
values ('Local Shop', 'Israel', 'Tel Aviv', 32.0853, 34.7818, 'physical', 'in_store_only', 25);
```

### Digital Store - Region Locked

```sql
insert into stores (name, country, city, latitude, longitude, product_type, available_countries)
values ('Netflix Israel', 'Israel', 'Tel Aviv', 32.0853, 34.7818, 'digital', ARRAY['Israel']);
```

### Digital Store - Global

```sql
insert into stores (name, country, city, latitude, longitude, product_type, available_countries)
values ('Udemy', 'United States', 'San Francisco', 37.7749, -122.4194, 'digital', NULL);
```

## Privacy & Performance

- Location uses approximate city-level data from IP
- Distance calculations use Haversine formula (accurate for Earth's curvature)
- Filtering happens client-side for responsive UX
- No GPS tracking, only IP geolocation
