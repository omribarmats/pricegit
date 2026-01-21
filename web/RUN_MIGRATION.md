# Run Price Verification Migration

To enable the price verification system, you need to run the migration on your Supabase database.

## Option 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open the file `web/migrations/add-price-verification.sql`
4. Copy the entire contents
5. Paste into the SQL Editor
6. Click **RUN** to execute the migration

## Option 2: Using Supabase CLI

If you have the Supabase CLI installed:

```bash
cd web
supabase db push
```

## Verify Migration

After running the migration, verify it worked:

```sql
-- Check if status column exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'price_history'
AND column_name IN ('status', 'reviewed_by', 'reviewed_at', 'rejection_reason');
```

You should see 4 rows returned.

## What the Migration Does

- Adds `status` column (pending/approved/rejected) to price_history
- Adds `reviewed_by`, `reviewed_at`, `rejection_reason` columns
- Creates indexes for performance
- Updates RLS policies to show only approved prices publicly
- Sets all existing prices to "approved" status (grandfathering them in)

## After Migration

Once the migration is complete, the verification system will be fully active:

- New price submissions will have `status: 'pending'`
- Users can review prices at `/moderate`
- Profile pages will show submission status tabs
- Product pages will show only approved prices (plus your own pending ones)
