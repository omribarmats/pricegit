-- Migration: Add regional pricing support
-- This adds captured_by_country and captured_by_city to price_history
-- and pricing_model to stores

-- Add new columns to stores table
ALTER TABLE stores 
ADD COLUMN IF NOT EXISTS pricing_model text NOT NULL DEFAULT 'regional_variable' 
CHECK (pricing_model IN ('global_fixed', 'regional_variable'));

-- Add new columns to price_history table
ALTER TABLE price_history
ADD COLUMN IF NOT EXISTS captured_by_country text,
ADD COLUMN IF NOT EXISTS captured_by_city text;

-- Create index for faster filtering by captured_by_country
CREATE INDEX IF NOT EXISTS price_history_captured_by_country_idx 
ON price_history(captured_by_country);

-- Update existing price_history entries with captured_by_country based on store location
-- This is a temporary fix - real data should come from actual user locations
UPDATE price_history ph
SET captured_by_country = s.country,
    captured_by_city = s.city
FROM stores s
WHERE ph.store_id = s.id
AND ph.captured_by_country IS NULL;

-- Make captured_by_country NOT NULL after backfilling data
ALTER TABLE price_history
ALTER COLUMN captured_by_country SET NOT NULL;

-- Update specific stores to be global_fixed pricing model
UPDATE stores 
SET pricing_model = 'global_fixed'
WHERE name IN ('Adobe Global', 'Spotify Global');

-- All other stores remain regional_variable (default)
