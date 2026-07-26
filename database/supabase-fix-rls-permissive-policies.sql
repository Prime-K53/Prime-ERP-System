-- ============================================================================
-- Fix: products id type, missing warehouses table, and missing permissive RLS policies
-- Run this in Supabase SQL Editor.
-- ============================================================================

-- ============================================================================
-- 1. Fix products.id type (was SERIAL integer, app uses TEXT ids like "RM-PAP-A4")
-- ============================================================================
ALTER TABLE public.products ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.products ALTER COLUMN id TYPE TEXT USING id::TEXT;
DROP SEQUENCE IF EXISTS public.products_id_seq;

-- Fix product_variants FK and column type
-- Uses dynamic SQL to find the actual FK constraint name (PostgreSQL auto-names it)
DO $$
DECLARE
  fk_name TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_variants') THEN
    -- Find any FK constraint on product_variants.product_id referencing products
    SELECT con.conname INTO fk_name
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'product_variants'
      AND con.contype = 'f'
      AND con.confrelid = (SELECT oid FROM pg_class WHERE relname = 'products' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public'))
    LIMIT 1;

    IF fk_name IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.product_variants DROP CONSTRAINT %I', fk_name);
    END IF;

    ALTER TABLE public.product_variants ALTER COLUMN product_id TYPE TEXT USING product_id::TEXT;
  END IF;
END $$;

-- ============================================================================
-- 2. Add missing warehouses table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.warehouses (
  id TEXT PRIMARY KEY,
  company_id TEXT,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_warehouses_company_id ON public.warehouses(company_id);
ALTER TABLE IF EXISTS public.warehouses ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. Add permissive RLS policies for ALL business tables
--    (tables previously had only RESTRICTIVE policies which block everything
--     without a permissive policy to actually grant access)
-- ============================================================================

-- Helper: drop and recreate permissive tenant policies for each table
DO $$
DECLARE
  tables TEXT[] := ARRAY[
    'bom_templates', 'inventory_items', 'products', 'product_variants',
    'market_adjustments', 'market_adjustment_transactions',
    'transaction_adjustment_snapshots', 'rounding_logs',
    'examination_batches', 'examination_classes', 'examination_subjects',
    'examination_bom_calculations', 'examination_class_adjustments',
    'examination_pricing_audit', 'examination_batch_notifications',
    'notification_audit_logs',
    'production_batches', 'production_classes', 'production_subjects',
    'production_bom_calculations', 'production_class_adjustments',
    'production_pricing_audit', 'production_batch_notifications',
    'production_notification_audit_logs', 'production_bom_templates',
    'production_bom_template_components',
    'sales', 'sale_items', 'invoices', 'inventory_transactions',
    'material_batches', 'warehouse_inventory', 'material_categories',
    'sales_orders', 'sales_exchanges', 'sales_exchange_items',
    'sales_exchange_approvals', 'reprint_jobs', 'audit_logs', 'documents',
    'tasks', 'classes', 'subjects', 'bom_default_materials',
    'profit_margin_settings', 'profit_margin_audit_logs',
    'work_centers', 'production_resources', 'work_orders',
    'chart_of_accounts', 'ledger_entries', 'budgets', 'transfers',
    'expenses', 'income', 'suppliers', 'purchase_orders', 'goods_receipts',
    'departments', 'employees', 'payroll_runs', 'payslips',
    'customer_payments', 'assets', 'settings', 'schools', 'examinations',
    'customers', 'inventory', 'user_groups',
    'bank_accounts', 'bank_transactions', 'bank_statements',
    'bank_scheduled_payments', 'bank_exchange_rates', 'bank_fees',
    'bank_reconciliations', 'bank_adjustments', 'bank_cash_flow_forecasts',
    'bank_alerts', 'bank_categories', 'customer_notification_logs',
    'whatsapp_chats', 'whatsapp_templates', 'whatsapp_campaigns',
    'whatsapp_automations', 'vat_transactions', 'vat_returns',
    'examination_jobs', 'examination_job_subjects',
    'examination_invoice_groups', 'examination_recurring_profiles',
    'examination_inventory_deductions', 'sms_campaigns', 'sms_templates',
    'subcontract_orders', 'maintenance_logs', 'job_tickets',
    'job_ticket_settings', 'job_orders', 'examination_papers',
    'examination_printing_batches', 'recurring_invoices',
    'scheduled_payments', 'wallet_transactions', 'delivery_notes',
    'tax_rates', 'warehouses', 'companies', 'profiles', 'idempotency_keys'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    BEGIN
      -- Drop the existing RESTRICTIVE policy first (it's too strict alone)
      DROP POLICY IF EXISTS tenant_isolation_policy ON public.companies;
      DROP POLICY IF EXISTS "tenant_all" ON public.companies;

      -- Create a permissive FOR ALL policy using company_id
      -- This is the standard Supabase pattern for tenant isolation
      EXECUTE format(
        'DROP POLICY IF EXISTS "tenant_all" ON %I', t
      );
      EXECUTE format(
        'CREATE POLICY "tenant_all" ON %I AS PERMISSIVE FOR ALL '
        'USING (company_id = public.get_user_company_id()) '
        'WITH CHECK (company_id = public.get_user_company_id())',
        t
      );
    EXCEPTION WHEN undefined_table THEN
      RAISE NOTICE 'Table % does not exist, skipping permissive policy', t;
    WHEN OTHERS THEN
      RAISE NOTICE 'Could not create policy for %: %', t, SQLERRM;
    END;
  END LOOP;
END $$;

-- ============================================================================
-- 4. Ensure companies and profiles also have their INSERT policies
--    (these need special handling: INSERT allows new companies during setup)
-- ============================================================================

-- Companies: keep the unrestricted INSERT, but use tenant_all for SELECT/UPDATE/DELETE
DROP POLICY IF EXISTS "tenant_all" ON public.companies;
CREATE POLICY "tenant_all" ON public.companies AS PERMISSIVE FOR ALL
  USING (id = public.get_user_company_id())
  WITH CHECK (id = public.get_user_company_id());

-- Profiles: users can insert their own profile, view/update based on user_id or company_id
DROP POLICY IF EXISTS "tenant_all" ON public.profiles;
CREATE POLICY "tenant_all" ON public.profiles AS PERMISSIVE FOR ALL
  USING (user_id = auth.uid()::text OR company_id = public.get_user_company_id())
  WITH CHECK (user_id = auth.uid()::text OR company_id = public.get_user_company_id());

-- ============================================================================
-- End of migration
-- ============================================================================
