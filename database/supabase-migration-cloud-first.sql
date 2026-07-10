-- ============================================================================
-- Cloud-First Migration: Prime ERP
-- Run this in Supabase SQL Editor to enable the cloud-first architecture.
-- ============================================================================

-- 1. Ensure idempotency_keys table exists and has the expires_at column
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  id UUID PRIMARY KEY,
  result TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS idempotency_keys 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires_at 
ON idempotency_keys(expires_at);

-- Clean up expired keys periodically (optional: run via cron)
-- DELETE FROM idempotency_keys WHERE expires_at < NOW() - INTERVAL '7 days';

-- Add company_id for tenant isolation
ALTER TABLE IF EXISTS idempotency_keys
ADD COLUMN IF NOT EXISTS company_id TEXT;

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_company_id
ON idempotency_keys(company_id);

-- 1b. Ensure tax_rates table exists for tax rate config sync
CREATE TABLE IF NOT EXISTS public.tax_rates (
  id TEXT PRIMARY KEY,
  data JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  company_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_tax_rates_company_id 
ON tax_rates(company_id);

-- 2. Ensure all business tables have updated_at for incremental sync
-- (Run for each table that should support incremental sync)
DO $$
DECLARE
  tables TEXT[] := ARRAY[
    'products', 'customers', 'suppliers', 'invoices', 'sales_orders',
    'production_batches', 'work_orders', 'ledger_entries', 'bank_accounts',
    'examination_batches', 'examination_jobs', 'inventory_transactions',
    'purchase_orders', 'goods_receipts', 'vat_transactions', 'profit_margin_settings',
    'market_adjustments', 'whatsapp_chats', 'settings', 'companies', 'profiles'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();', t);
    EXCEPTION WHEN undefined_table THEN
      RAISE NOTICE 'Table % does not exist, skipping', t;
    END;
  END LOOP;
END $$;

-- 3. Enable Realtime for all tables (so changes propagate to other devices)
DO $$
DECLARE
  tables TEXT[] := ARRAY[
    'products', 'customers', 'suppliers', 'invoices', 'sales_orders',
    'production_batches', 'work_orders', 'work_centers', 'production_resources',
    'ledger_entries', 'bank_accounts', 'bank_transactions',
    'examination_batches', 'examination_jobs', 'examination_job_subjects',
    'inventory_transactions', 'inventory', 'warehouse_inventory',
    'purchase_orders', 'goods_receipts', 'vat_transactions',
    'profit_margin_settings', 'market_adjustments', 'whatsapp_chats',
    'settings', 'companies', 'profiles', 'users',
    'sales', 'expenses', 'purchase_orders', 'inventory_movements',
    'customers', 'suppliers', 'inventory'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not add % to publication: %', t, SQLERRM;
    END;
  END LOOP;
END $$;

-- 4. Add company_id index for multi-tenant queries
DO $$
DECLARE
  tables TEXT[] := ARRAY[
    'products', 'customers', 'suppliers', 'invoices', 'sales_orders',
    'production_batches', 'work_orders', 'ledger_entries',
    'examination_batches', 'inventory_transactions',
    'purchase_orders', 'vat_transactions', 'profit_margin_settings',
    'market_adjustments', 'whatsapp_chats', 'settings'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    BEGIN
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_company_id ON %I(company_id)', t, t);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not index %: %', t, SQLERRM;
    END;
  END LOOP;
END $$;
