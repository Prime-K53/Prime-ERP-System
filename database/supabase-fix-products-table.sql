-- ============================================================================
-- Fix products table to match cloudDb.put document-store pattern
-- Run this in Supabase SQL Editor if cloud sync of inventory items fails with:
--   "Could not find the 'data' column of 'products' in the schema cache"
-- ============================================================================

-- 1. Change id from SERIAL (integer) to TEXT
ALTER TABLE products ALTER COLUMN id DROP DEFAULT;
ALTER TABLE products ALTER COLUMN id TYPE TEXT USING id::TEXT;

-- 2. Update FK column in product_variants if that table exists
ALTER TABLE IF EXISTS product_variants
  DROP CONSTRAINT IF EXISTS product_variants_product_id_fkey;
ALTER TABLE IF EXISTS product_variants
  ALTER COLUMN product_id TYPE TEXT USING product_id::TEXT;
ALTER TABLE IF EXISTS product_variants
  ADD CONSTRAINT product_variants_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

-- 5. Add data JSONB column (cloudDb.put stores the entire item payload here)
ALTER TABLE products ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;

-- 6. Ensure company_id exists (for multi-tenant isolation)
ALTER TABLE products ADD COLUMN IF NOT EXISTS company_id TEXT;

CREATE INDEX IF NOT EXISTS idx_products_company_id ON products(company_id);

-- 7. Ensure updated_at exists (should already be added by supabase-migration-cloud-first.sql)
ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 8. Drop the SERIAL sequence (no longer needed)
DROP SEQUENCE IF EXISTS products_id_seq;
