-- ============================================================================
-- Cloud-First Migration: Prime ERP
-- Run this in Supabase SQL Editor to enable the cloud-first architecture.
-- ============================================================================

-- 1. Ensure idempotency_keys table has the expires_at column
ALTER TABLE IF EXISTS idempotency_keys 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires_at 
ON idempotency_keys(expires_at);

-- Clean up expired keys periodically (optional: run via cron)
-- DELETE FROM idempotency_keys WHERE expires_at < NOW() - INTERVAL '7 days';

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
    EXECUTE format('
      DO $$ BEGIN
        ALTER TABLE %I ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
      EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE ''Table % does not exist, skipping'', %L;
      END $$;
    ', t, t);
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
