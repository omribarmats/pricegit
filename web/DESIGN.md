# PriceGit Design Guidelines

## Color Palette

### Background Colors

- **Default background**: `bg-[#F5EDF5]/20` (#F5EDF5 with 20% opacity)
  - Use this for cards, sections, headers, and any element backgrounds
  - Example: `className="bg-[#F5EDF5]/20"`

## Component Patterns

### Headers

- Sitewide header uses `bg-[#F5EDF5]/20` with border-bottom

### Search

- Dropdown suggestions close on click outside
- Minimum 2 characters to trigger search

## Database Architecture

### Key Decisions

- **No `current_price` field** in products table (prices vary by location/store)
- **No `product_url` field** in products table (URLs are per price capture, stored in price_history)
- **Price filtering by location**: Show prices captured in user's country for crowd-sourced availability
- **Store identification**: (name, country) unique constraint to prevent duplicates

## URL Structure

### Product Pages

- Format: `/product/{uuid}/{slug}`
- UUID is permanent, slug can change
- Redirects to correct slug if product name changes
