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
DROP POLICY IF EXISTS "Authenticated users can insert companies" ON public.companies;
DROP POLICY IF EXISTS "Authenticated users can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can manage idempotency keys" ON public.idempotency_keys;

-- 4. Helper: get the current user's company_id (SECURITY DEFINER to bypass RLS)

CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE user_id = auth.uid()::text LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_company_id() TO authenticated;

-- 5. Companies table policies
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
  USING (id = public.get_user_company_id());

-- Allow users to update their own company
CREATE POLICY "Users can update their company"
  ON public.companies
  FOR UPDATE
  TO authenticated
  USING (id = public.get_user_company_id())
  WITH CHECK (id = public.get_user_company_id());

-- 6. Profiles table policies
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
    user_id = auth.uid()::text
    OR company_id = public.get_user_company_id()
  );

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- 7. Idempotency keys table policies
CREATE POLICY "Authenticated users can manage idempotency keys"
  ON public.idempotency_keys
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 8. Examination tables RLS policies
-- Enable RLS on all examination tables
ALTER TABLE public.examination_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.examination_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.examination_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.examination_bom_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.examination_class_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.examination_pricing_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.examination_batch_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_default_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_batches ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts on re-run
DROP POLICY IF EXISTS "tenant_examination_batches" ON public.examination_batches;
DROP POLICY IF EXISTS "tenant_examination_classes" ON public.examination_classes;
DROP POLICY IF EXISTS "tenant_examination_subjects" ON public.examination_subjects;
DROP POLICY IF EXISTS "tenant_examination_bom_calculations" ON public.examination_bom_calculations;
DROP POLICY IF EXISTS "tenant_examination_class_adjustments" ON public.examination_class_adjustments;
DROP POLICY IF EXISTS "tenant_examination_pricing_audit" ON public.examination_pricing_audit;
DROP POLICY IF EXISTS "tenant_examination_batch_notifications" ON public.examination_batch_notifications;
DROP POLICY IF EXISTS "tenant_notification_audit_logs" ON public.notification_audit_logs;
DROP POLICY IF EXISTS "tenant_bom_default_materials" ON public.bom_default_materials;
DROP POLICY IF EXISTS "tenant_work_centers" ON public.work_centers;
DROP POLICY IF EXISTS "tenant_production_resources" ON public.production_resources;
DROP POLICY IF EXISTS "tenant_work_orders" ON public.work_orders;
DROP POLICY IF EXISTS "tenant_production_batches" ON public.production_batches;

-- Examination Batches
CREATE POLICY "tenant_examination_batches"
  ON public.examination_batches
  FOR ALL
  TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

-- Examination Classes
CREATE POLICY "tenant_examination_classes"
  ON public.examination_classes
  FOR ALL
  TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

-- Examination Subjects
CREATE POLICY "tenant_examination_subjects"
  ON public.examination_subjects
  FOR ALL
  TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

-- Examination BOM Calculations
CREATE POLICY "tenant_examination_bom_calculations"
  ON public.examination_bom_calculations
  FOR ALL
  TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

-- Examination Class Adjustments
CREATE POLICY "tenant_examination_class_adjustments"
  ON public.examination_class_adjustments
  FOR ALL
  TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

-- Examination Pricing Audit
CREATE POLICY "tenant_examination_pricing_audit"
  ON public.examination_pricing_audit
  FOR ALL
  TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

-- Examination Batch Notifications
CREATE POLICY "tenant_examination_batch_notifications"
  ON public.examination_batch_notifications
  FOR ALL
  TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

-- Notification Audit Logs
CREATE POLICY "tenant_notification_audit_logs"
  ON public.notification_audit_logs
  FOR ALL
  TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

-- BOM Default Materials
CREATE POLICY "tenant_bom_default_materials"
  ON public.bom_default_materials
  FOR ALL
  TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

-- Work Centers
CREATE POLICY "tenant_work_centers"
  ON public.work_centers
  FOR ALL
  TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

-- Production Resources
CREATE POLICY "tenant_production_resources"
  ON public.production_resources
  FOR ALL
  TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

-- Work Orders
CREATE POLICY "tenant_work_orders"
  ON public.work_orders
  FOR ALL
  TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

-- Production Batches
CREATE POLICY "tenant_production_batches"
  ON public.production_batches
  FOR ALL
  TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

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
    'customer_payments', 'supplier_payments', 'assets', 'settings',
    'schools', 'examinations', 'customers', 'inventory',
    'delivery_notes', 'wallet_transactions', 'cheques',
    'recurring_invoices', 'scheduled_payments'
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
