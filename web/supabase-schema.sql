-- Drop existing tables for fresh start
drop table if exists price_history cascade;
drop table if exists products cascade;
drop table if exists stores cascade;

-- Create stores table
create table stores (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  country text not null,
  city text,
  latitude decimal(10, 8),
  longitude decimal(11, 8),
  product_type text not null check (product_type in ('physical', 'digital')),
  fulfillment_type text check (fulfillment_type in ('shipping', 'in_store_only')),
  shipping_scope text check (shipping_scope in ('local', 'national', 'international', 'global')),
  condition text not null default 'new' check (condition in ('new', 'used')),
  seller_type text default 'retailer' check (seller_type in ('retailer', 'private')),
  currency text default 'USD',
  pricing_model text not null default 'regional_variable' check (pricing_model in ('global_fixed', 'regional_variable')),
  local_radius_km integer,
  shipping_countries text[],
  available_countries text[],
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create products table
create table products (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  current_price decimal(10, 2) not null,
  image_url text,
  product_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create price_history table
create table price_history (
  id uuid default gen_random_uuid() primary key,
  product_id uuid references products(id) on delete cascade not null,
  store_id uuid references stores(id) on delete cascade not null,
  price decimal(10, 2) not null,
  source text not null,
  source_url text,
  captured_by_country text not null,
  captured_by_city text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create index for faster queries
create index price_history_product_id_idx on price_history(product_id);
create index price_history_store_id_idx on price_history(store_id);
create index price_history_created_at_idx on price_history(created_at desc);
create index price_history_captured_by_country_idx on price_history(captured_by_country);
create index stores_country_idx on stores(country);
create index stores_city_idx on stores(city);

-- Enable Row Level Security
alter table products enable row level security;
alter table price_history enable row level security;
alter table stores enable row level security;

-- Create policies for public read access
create policy "Enable read access for all users" on products
  for select using (true);

create policy "Enable read access for all users" on price_history
  for select using (true);

create policy "Enable read access for all users" on stores
  for select using (true);

-- Sample data
-- Stores with different fulfillment types

-- Physical stores - National shipping
insert into stores (name, country, city, latitude, longitude, product_type, fulfillment_type, shipping_scope, currency, pricing_model) values
  ('Amazon Israel', 'Israel', 'Tel Aviv', 32.0853, 34.7818, 'physical', 'shipping', 'national', 'ILS', 'regional_variable'),
  ('Amazon US', 'United States', 'New York', 40.7128, -74.0060, 'physical', 'shipping', 'national', 'USD', 'regional_variable');

-- Physical stores - International shipping
insert into stores (name, country, city, latitude, longitude, product_type, fulfillment_type, shipping_scope, currency, pricing_model, shipping_countries) values
  ('B&H Photo', 'United States', 'New York', 40.7128, -74.0060, 'physical', 'shipping', 'international', 'USD', 'regional_variable',
   ARRAY['United States', 'Canada', 'Israel', 'United Kingdom', 'Germany']);

-- Physical stores - Local shipping only
insert into stores (name, country, city, latitude, longitude, product_type, fulfillment_type, shipping_scope, currency, pricing_model, local_radius_km) values
  ('Cameras Online IL', 'Israel', 'Tel Aviv', 32.0853, 34.7818, 'physical', 'shipping', 'local', 'ILS', 'regional_variable', 50);

-- Physical stores - In-store only
insert into stores (name, country, city, latitude, longitude, product_type, fulfillment_type, currency, pricing_model, local_radius_km) values
  ('Local Camera Shop TLV', 'Israel', 'Tel Aviv', 32.0853, 34.7818, 'physical', 'in_store_only', 'ILS', 'regional_variable', 30),
  ('Best Buy NYC', 'United States', 'New York', 40.7128, -74.0060, 'physical', 'in_store_only', 'USD', 'regional_variable', 40);

-- Digital stores - Region specific
insert into stores (name, country, city, latitude, longitude, product_type, currency, pricing_model, available_countries) values
  ('KSP Israel (Digital)', 'Israel', 'Ramat Gan', 32.0833, 34.8167, 'digital', 'ILS', 'regional_variable', ARRAY['Israel']),
  ('Steam Israel', 'Israel', 'Tel Aviv', 32.0853, 34.7818, 'digital', 'ILS', 'regional_variable', ARRAY['Israel']);

-- Digital stores - Global
insert into stores (name, country, city, latitude, longitude, product_type, currency, pricing_model, available_countries) values
  ('Adobe Global', 'United States', 'San Jose', 37.3382, -121.8863, 'digital', 'USD', 'global_fixed', NULL),
  ('Spotify Global', 'United States', 'New York', 40.7128, -74.0060, 'digital', 'USD', 'global_fixed', NULL);

-- Second-hand marketplaces - Local only (require meetup or local delivery)
insert into stores (name, country, city, latitude, longitude, product_type, fulfillment_type, condition, seller_type, currency, pricing_model, local_radius_km) values
  ('Facebook Marketplace TLV', 'Israel', 'Tel Aviv', 32.0853, 34.7818, 'physical', 'in_store_only', 'used', 'private', 'ILS', 'regional_variable', 30),
  ('Facebook Marketplace NYC', 'United States', 'New York', 40.7128, -74.0060, 'physical', 'in_store_only', 'used', 'private', 'USD', 'regional_variable', 40),
  ('Craigslist NYC', 'United States', 'New York', 40.7128, -74.0060, 'physical', 'in_store_only', 'used', 'private', 'USD', 'regional_variable', 40),
  ('Yad2 TLV', 'Israel', 'Tel Aviv', 32.0853, 34.7818, 'physical', 'in_store_only', 'used', 'private', 'ILS', 'regional_variable', 30);

-- Products
insert into products (name, current_price, image_url, product_url) values
  ('DJI Osmo 3', 535.00, null, 'https://www.amazon.com/dji-osmo-3'),
  ('Sony A7 IV Camera', 2498.00, null, 'https://www.amazon.com/sony-a7-iv'),
  ('Sony WH-1000XM5 Headphones', 399.99, null, 'https://www.amazon.com/sony-wh1000xm5'),
  ('Apple AirPods Pro (2nd Gen)', 199.00, null, 'https://www.amazon.com/airpods-pro'),
  ('Apple iPad Pro 12.9"', 1099.00, null, 'https://www.apple.com/ipad-pro'),
  ('Adobe Photoshop License', 54.99, null, 'https://www.adobe.com/photoshop'),
  ('Spotify Premium', 9.99, null, 'https://www.spotify.com/premium'),
  ('Nintendo Switch OLED', 349.99, null, 'https://www.bestbuy.com/nintendo-switch-oled');

-- DJI Osmo 3 - Available in multiple stores with different shipping
insert into price_history (product_id, store_id, price, source, source_url, captured_by_country, captured_by_city, created_at) 
select p.id, s.id, 535.00, 'Amazon Israel', 'https://www.amazon.com/dji-osmo-3', 'Israel', 'Tel Aviv', timezone('utc'::text, now() - interval '2 hours')
from products p, stores s where p.name = 'DJI Osmo 3' and s.name = 'Amazon Israel';

insert into price_history (product_id, store_id, price, source, source_url, captured_by_country, captured_by_city, created_at) 
select p.id, s.id, 650.00, 'Cameras Online', 'https://cameras.online/dji-osmo-3', 'Israel', 'Tel Aviv', timezone('utc'::text, now() - interval '1 day')
from products p, stores s where p.name = 'DJI Osmo 3' and s.name = 'Cameras Online IL';

insert into price_history (product_id, store_id, price, source, source_url, captured_by_country, captured_by_city, created_at) 
select p.id, s.id, 580.00, 'Local Camera Shop', 'https://localcamera.co.il/dji-osmo-3', 'Israel', 'Tel Aviv', timezone('utc'::text, now() - interval '3 days')
from products p, stores s where p.name = 'DJI Osmo 3' and s.name = 'Local Camera Shop TLV';

insert into price_history (product_id, store_id, price, source, source_url, created_at) 
select p.id, s.id, 499.00, 'B&H Photo', 'https://www.bhphotovideo.com/dji-osmo-3', timezone('utc'::text, now() - interval '5 hours')
from products p, stores s where p.name = 'DJI Osmo 3' and s.name = 'B&H Photo';

-- Sony A7 IV - US stores with 30-day price history
-- B&H Photo price history (showing gradual price drop)
insert into price_history (product_id, store_id, price, source, source_url, created_at) 
select p.id, s.id, 2548.00, 'B&H Photo', 'https://www.bhphotovideo.com/sony-a7-iv', timezone('utc'::text, now() - interval '5 hours')
from products p, stores s where p.name = 'Sony A7 IV Camera' and s.name = 'B&H Photo';

insert into price_history (product_id, store_id, price, source, source_url, created_at) 
select p.id, s.id, 2599.00, 'B&H Photo', 'https://www.bhphotovideo.com/sony-a7-iv', timezone('utc'::text, now() - interval '7 days')
from products p, stores s where p.name = 'Sony A7 IV Camera' and s.name = 'B&H Photo';

insert into price_history (product_id, store_id, price, source, source_url, created_at) 
select p.id, s.id, 2649.00, 'B&H Photo', 'https://www.bhphotovideo.com/sony-a7-iv', timezone('utc'::text, now() - interval '14 days')
from products p, stores s where p.name = 'Sony A7 IV Camera' and s.name = 'B&H Photo';

insert into price_history (product_id, store_id, price, source, source_url, created_at) 
select p.id, s.id, 2698.00, 'B&H Photo', 'https://www.bhphotovideo.com/sony-a7-iv', timezone('utc'::text, now() - interval '21 days')
from products p, stores s where p.name = 'Sony A7 IV Camera' and s.name = 'B&H Photo';

insert into price_history (product_id, store_id, price, source, source_url, created_at) 
select p.id, s.id, 2698.00, 'B&H Photo', 'https://www.bhphotovideo.com/sony-a7-iv', timezone('utc'::text, now() - interval '30 days')
from products p, stores s where p.name = 'Sony A7 IV Camera' and s.name = 'B&H Photo';

-- Amazon US price history (fluctuating)
insert into price_history (product_id, store_id, price, source, source_url, created_at) 
select p.id, s.id, 2498.00, 'Amazon US', 'https://www.amazon.com/sony-a7-iv', timezone('utc'::text, now() - interval '3 days')
from products p, stores s where p.name = 'Sony A7 IV Camera' and s.name = 'Amazon US';

insert into price_history (product_id, store_id, price, source, source_url, created_at) 
select p.id, s.id, 2520.00, 'Amazon US', 'https://www.amazon.com/sony-a7-iv', timezone('utc'::text, now() - interval '8 days')
from products p, stores s where p.name = 'Sony A7 IV Camera' and s.name = 'Amazon US';

insert into price_history (product_id, store_id, price, source, source_url, created_at) 
select p.id, s.id, 2599.00, 'Amazon US', 'https://www.amazon.com/sony-a7-iv', timezone('utc'::text, now() - interval '15 days')
from products p, stores s where p.name = 'Sony A7 IV Camera' and s.name = 'Amazon US';

insert into price_history (product_id, store_id, price, source, source_url, created_at) 
select p.id, s.id, 2650.00, 'Amazon US', 'https://www.amazon.com/sony-a7-iv', timezone('utc'::text, now() - interval '22 days')
from products p, stores s where p.name = 'Sony A7 IV Camera' and s.name = 'Amazon US';

insert into price_history (product_id, store_id, price, source, source_url, created_at) 
select p.id, s.id, 2699.00, 'Amazon US', 'https://www.amazon.com/sony-a7-iv', timezone('utc'::text, now() - interval '29 days')
from products p, stores s where p.name = 'Sony A7 IV Camera' and s.name = 'Amazon US';

-- Best Buy price history (stable then slight increase)
insert into price_history (product_id, store_id, price, source, source_url, created_at) 
select p.id, s.id, 2599.00, 'Best Buy', 'https://www.bestbuy.com/sony-a7-iv', timezone('utc'::text, now() - interval '1 day')
from products p, stores s where p.name = 'Sony A7 IV Camera' and s.name = 'Best Buy NYC';

insert into price_history (product_id, store_id, price, source, source_url, created_at) 
select p.id, s.id, 2599.00, 'Best Buy', 'https://www.bestbuy.com/sony-a7-iv', timezone('utc'::text, now() - interval '10 days')
from products p, stores s where p.name = 'Sony A7 IV Camera' and s.name = 'Best Buy NYC';

insert into price_history (product_id, store_id, price, source, source_url, created_at) 
select p.id, s.id, 2549.00, 'Best Buy', 'https://www.bestbuy.com/sony-a7-iv', timezone('utc'::text, now() - interval '18 days')
from products p, stores s where p.name = 'Sony A7 IV Camera' and s.name = 'Best Buy NYC';

insert into price_history (product_id, store_id, price, source, source_url, created_at) 
select p.id, s.id, 2549.00, 'Best Buy', 'https://www.bestbuy.com/sony-a7-iv', timezone('utc'::text, now() - interval '26 days')
from products p, stores s where p.name = 'Sony A7 IV Camera' and s.name = 'Best Buy NYC';

-- AirPods Pro - Mixed availability
insert into price_history (product_id, store_id, price, source, source_url, created_at) 
select p.id, s.id, 199.00, 'Amazon US', 'https://www.amazon.com/airpods-pro', timezone('utc'::text, now() - interval '1 day')
from products p, stores s where p.name = 'Apple AirPods Pro (2nd Gen)' and s.name = 'Amazon US';

insert into price_history (product_id, store_id, price, source, source_url, created_at) 
select p.id, s.id, 849.00, 'KSP Digital', 'https://ksp.co.il/airpods-pro', timezone('utc'::text, now() - interval '3 hours')
from products p, stores s where p.name = 'Apple AirPods Pro (2nd Gen)' and s.name = 'KSP Israel (Digital)';

insert into price_history (product_id, store_id, price, source, source_url, created_at) 
select p.id, s.id, 209.00, 'Best Buy', 'https://www.bestbuy.com/airpods-pro', timezone('utc'::text, now() - interval '6 hours')
from products p, stores s where p.name = 'Apple AirPods Pro (2nd Gen)' and s.name = 'Best Buy NYC';

-- Adobe Photoshop - Digital global product
insert into price_history (product_id, store_id, price, source, source_url, created_at) 
select p.id, s.id, 54.99, 'Adobe', 'https://www.adobe.com/photoshop', timezone('utc'::text, now() - interval '1 hour')
from products p, stores s where p.name = 'Adobe Photoshop License' and s.name = 'Adobe Global';

-- Spotify - Digital global product
insert into price_history (product_id, store_id, price, source, source_url, created_at) 
select p.id, s.id, 9.99, 'Spotify', 'https://www.spotify.com/premium', timezone('utc'::text, now() - interval '2 hours')
from products p, stores s where p.name = 'Spotify Premium' and s.name = 'Spotify Global';

insert into price_history (product_id, store_id, price, source, source_url, created_at) 
select p.id, s.id, 16.90, 'Spotify Israel', 'https://www.spotify.com/il/premium', timezone('utc'::text, now() - interval '1 hour')
from products p, stores s where p.name = 'Spotify Premium' and s.name = 'Steam Israel';

-- Nintendo Switch OLED - Only available in US (Best Buy in-store only, NOT available in Israel)
insert into price_history (product_id, store_id, price, source, source_url, created_at) 
select p.id, s.id, 349.99, 'Best Buy NYC', 'https://www.bestbuy.com/nintendo-switch-oled', timezone('utc'::text, now() - interval '2 hours')
from products p, stores s where p.name = 'Nintendo Switch OLED' and s.name = 'Best Buy NYC';

-- Sony WH-1000XM5 Headphones - Available in multiple stores
insert into price_history (product_id, store_id, price, source, source_url, created_at) 
select p.id, s.id, 399.99, 'Amazon US', 'https://www.amazon.com/sony-wh1000xm5', timezone('utc'::text, now() - interval '1 day')
from products p, stores s where p.name = 'Sony WH-1000XM5 Headphones' and s.name = 'Amazon US';

insert into price_history (product_id, store_id, price, source, source_url, created_at) 
select p.id, s.id, 419.99, 'B&H Photo', 'https://www.bhphotovideo.com/sony-wh1000xm5', timezone('utc'::text, now() - interval '3 hours')
from products p, stores s where p.name = 'Sony WH-1000XM5 Headphones' and s.name = 'B&H Photo';

insert into price_history (product_id, store_id, price, source, source_url, created_at) 
select p.id, s.id, 1499.00, 'KSP Digital', 'https://ksp.co.il/sony-wh1000xm5', timezone('utc'::text, now() - interval '5 hours')
from products p, stores s where p.name = 'Sony WH-1000XM5 Headphones' and s.name = 'KSP Israel (Digital)';

-- Apple iPad Pro 12.9" - Available globally
insert into price_history (product_id, store_id, price, source, source_url, created_at) 
select p.id, s.id, 1099.00, 'Amazon US', 'https://www.amazon.com/ipad-pro', timezone('utc'::text, now() - interval '4 hours')
from products p, stores s where p.name = 'Apple iPad Pro 12.9"' and s.name = 'Amazon US';

insert into price_history (product_id, store_id, price, source, source_url, created_at) 
select p.id, s.id, 1129.00, 'B&H Photo', 'https://www.bhphotovideo.com/ipad-pro', timezone('utc'::text, now() - interval '2 days')
from products p, stores s where p.name = 'Apple iPad Pro 12.9"' and s.name = 'B&H Photo';

insert into price_history (product_id, store_id, price, source, source_url, created_at) 
select p.id, s.id, 4799.00, 'KSP Digital', 'https://ksp.co.il/ipad-pro', timezone('utc'::text, now() - interval '1 hour')
from products p, stores s where p.name = 'Apple iPad Pro 12.9"' and s.name = 'KSP Israel (Digital)';

-- Second-hand listings (these appear at the bottom)
-- DJI Osmo 3 used
insert into price_history (product_id, store_id, price, source, source_url, created_at) 
select p.id, s.id, 350.00, 'Facebook Marketplace', 'https://facebook.com/marketplace/item/123', timezone('utc'::text, now() - interval '2 hours')
from products p, stores s where p.name = 'DJI Osmo 3' and s.name = 'Facebook Marketplace TLV';

insert into price_history (product_id, store_id, price, source, source_url, created_at) 
select p.id, s.id, 320.00, 'Yad2', 'https://yad2.co.il/item/123', timezone('utc'::text, now() - interval '1 day')
from products p, stores s where p.name = 'DJI Osmo 3' and s.name = 'Yad2 TLV';

-- Sony A7 IV used
insert into price_history (product_id, store_id, price, source, source_url, created_at) 
select p.id, s.id, 1899.00, 'Facebook Marketplace', 'https://facebook.com/marketplace/item/456', timezone('utc'::text, now() - interval '5 hours')
from products p, stores s where p.name = 'Sony A7 IV Camera' and s.name = 'Facebook Marketplace NYC';

insert into price_history (product_id, store_id, price, source, source_url, created_at) 
select p.id, s.id, 1950.00, 'Craigslist', 'https://newyork.craigslist.org/item/789', timezone('utc'::text, now() - interval '3 days')
from products p, stores s where p.name = 'Sony A7 IV Camera' and s.name = 'Craigslist NYC';

-- AirPods Pro used
insert into price_history (product_id, store_id, price, source, source_url, created_at) 
select p.id, s.id, 140.00, 'Facebook Marketplace', 'https://facebook.com/marketplace/item/789', timezone('utc'::text, now() - interval '8 hours')
from products p, stores s where p.name = 'Apple AirPods Pro (2nd Gen)' and s.name = 'Facebook Marketplace NYC';

-- Nintendo Switch OLED used
insert into price_history (product_id, store_id, price, source, source_url, created_at) 
select p.id, s.id, 280.00, 'Craigslist', 'https://newyork.craigslist.org/item/999', timezone('utc'::text, now() - interval '12 hours')
from products p, stores s where p.name = 'Nintendo Switch OLED' and s.name = 'Craigslist NYC';

-- Sony WH-1000XM5 used
insert into price_history (product_id, store_id, price, source, source_url, created_at) 
select p.id, s.id, 250.00, 'Yad2', 'https://yad2.co.il/item/456', timezone('utc'::text, now() - interval '6 hours')
from products p, stores s where p.name = 'Sony WH-1000XM5 Headphones' and s.name = 'Yad2 TLV';

-- iPad Pro used
insert into price_history (product_id, store_id, price, source, source_url, created_at) 
select p.id, s.id, 850.00, 'Facebook Marketplace', 'https://facebook.com/marketplace/item/111', timezone('utc'::text, now() - interval '4 hours')
from products p, stores s where p.name = 'Apple iPad Pro 12.9"' and s.name = 'Facebook Marketplace NYC';

