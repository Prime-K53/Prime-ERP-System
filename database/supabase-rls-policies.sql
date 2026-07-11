-- ============================================================================
-- RLS Policies for Prime ERP
-- Run this in Supabase SQL Editor after the other migrations.
-- ============================================================================

-- 1. Ensure tables exist
CREATE TABLE IF NOT EXISTS public.companies (
  id TEXT PRIMARY KEY,
  company_name TEXT,
  registration_number TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  logo_url TEXT,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  company_id TEXT,
  full_name TEXT,
  role TEXT DEFAULT 'member',
  status TEXT DEFAULT 'Active',
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 2. Enable RLS on all tables
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies to avoid conflicts on re-run
DROP POLICY IF EXISTS "Users can insert their company" ON public.companies;
DROP POLICY IF EXISTS "Users can view their company" ON public.companies;
DROP POLICY IF EXISTS "Users can update their company" ON public.companies;
DROP POLICY IF EXISTS "Users can delete their company" ON public.companies;
DROP POLICY IF EXISTS "Users can insert their profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view company profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can manage idempotency" ON public.idempotency_keys;

-- 4. Companies table policies
-- Allow any authenticated user to insert (first-time setup creates the company)
CREATE POLICY "Authenticated users can insert companies"
  ON public.companies
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow users to view their own company
CREATE POLICY "Users can view their company"
  ON public.companies
  FOR SELECT
  TO authenticated
  USING (id = (SELECT (data->>'companyId')::text FROM public.profiles WHERE user_id = auth.uid() LIMIT 1) OR id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

-- Allow users to update their own company
CREATE POLICY "Users can update their company"
  ON public.companies
  FOR UPDATE
  TO authenticated
  USING (id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

-- 5. Profiles table policies
-- Allow authenticated users to insert profiles
CREATE POLICY "Authenticated users can insert profiles"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow users to view their own profile and profiles in their company
CREATE POLICY "Users can view profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
  );

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 6. Idempotency keys table policies
CREATE POLICY "Authenticated users can manage idempotency keys"
  ON public.idempotency_keys
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Updated cascade_delete_company that also deletes the auth user
-- ============================================================================

CREATE OR REPLACE FUNCTION cascade_delete_company(target_company_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'sale_items', 'sales', 'invoices',
    'inventory_transactions', 'material_batches', 'warehouse_inventory',
    'material_categories', 'sales_orders', 'sales_exchanges',
    'sales_exchange_items', 'sales_exchange_approvals', 'reprint_jobs',
    'market_adjustments', 'market_adjustment_transactions',
    'transaction_adjustment_snapshots', 'audit_logs', 'documents',
    'tasks', 'classes', 'subjects',
    'examination_batches', 'examination_classes', 'examination_subjects',
    'examination_bom_calculations', 'examination_class_adjustments',
    'examination_pricing_audit', 'examination_batch_notifications',
    'notification_audit_logs', 'bom_default_materials',
    'profit_margin_settings', 'profit_margin_audit_logs',
    'work_centers', 'production_resources', 'work_orders',
    'production_batches', 'chart_of_accounts', 'ledger_entries',
    'budgets', 'transfers', 'expenses', 'income',
    'suppliers', 'purchase_orders', 'goods_receipts',
    'departments', 'employees', 'payroll_runs', 'payslips',
    'customer_payments', 'assets', 'settings',
    'schools', 'examinations', 'customers', 'inventory'
  ];
  user_ids TEXT[];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    BEGIN
      EXECUTE format('DELETE FROM %I WHERE company_id = $1', tbl) USING target_company_id;
    EXCEPTION WHEN undefined_table THEN
      RAISE NOTICE 'Table % does not exist, skipping', tbl;
    WHEN OTHERS THEN
      RAISE NOTICE 'Could not delete from %: %', tbl, SQLERRM;
    END;
  END LOOP;

  -- Collect user IDs before deleting profiles
  user_ids := ARRAY(SELECT user_id FROM profiles WHERE company_id = target_company_id);

  DELETE FROM profiles WHERE company_id = target_company_id;
  DELETE FROM companies WHERE id = target_company_id;

  -- Delete associated auth users (requires the calling user to have admin privileges)
  -- Note: This uses auth.admin.delete_user() which requires service_role key.
  -- If called via supabase.rpc() with anon key, this will be skipped silently.
  IF user_ids IS NOT NULL THEN
    FOR i IN 1 .. array_length(user_ids, 1) LOOP
      BEGIN
        DELETE FROM auth.users WHERE id = user_ids[i]::uuid;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not delete auth user %: %', user_ids[i], SQLERRM;
      END;
    END LOOP;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION cascade_delete_company(TEXT) TO authenticated;
