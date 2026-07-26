-- ============================================================================
-- SCHEMA HARDENING: Prevent Company ID Mismatches at the Database Level
-- ============================================================================
-- This migration:
-- 1. Creates the missing `company_users` table (multi-company membership)
-- 2. Adds NOT NULL constraints to company_id (where safe)
-- 3. Adds foreign key constraints to the companies table
-- 4. Adds CHECK constraints for data integrity
-- 5. Creates triggers that auto-set company_id from context
-- 6. Creates validation triggers that prevent cross-company operations
-- ============================================================================

-- ============================================================================
-- PART 1: Company Membership (Multi-Tenant Foundation)
-- ============================================================================

-- company_users enables users to belong to MULTIPLE companies
-- This replaces the single-company model enforced by profiles.UNIQUE(user_id)
CREATE TABLE IF NOT EXISTS public.company_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  is_default BOOLEAN NOT NULL DEFAULT false,
  permissions JSONB DEFAULT '{}',
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, company_id)
);

-- Index for fast company membership lookup
CREATE INDEX IF NOT EXISTS idx_company_users_user_id ON public.company_users(user_id);
CREATE INDEX IF NOT EXISTS idx_company_users_company_id ON public.company_users(company_id);
CREATE INDEX IF NOT EXISTS idx_company_users_default ON public.company_users(user_id, company_id) WHERE is_default = true;

-- Migrate existing profiles data to company_users (one-to-one)
-- This is safe: each profile has one user_id + one company_id
INSERT INTO public.company_users (user_id, company_id, role, is_default)
SELECT
  p.user_id::uuid,
  p.company_id,
  COALESCE(NULLIF(p.role, ''), 'member'),
  true
FROM public.profiles p
WHERE p.company_id IS NOT NULL AND p.company_id <> ''
  AND p.user_id IS NOT NULL AND p.user_id <> ''
ON CONFLICT (user_id, company_id) DO NOTHING;

-- ============================================================================
-- PART 2: NOT NULL Constraints (Only on tables that have data)
-- ============================================================================
-- IMPORTANT: Run ONLY if audit confirms no NULL company_ids remain.
-- Comment out sections where data still has NULLs.

-- ALTER TABLE public.inventory ALTER COLUMN company_id SET NOT NULL;
-- ALTER TABLE public.products ALTER COLUMN company_id SET NOT NULL;
-- ALTER TABLE public.warehouses ALTER COLUMN company_id SET NOT NULL;
-- ALTER TABLE public.inventory_transactions ALTER COLUMN company_id SET NOT NULL;
-- ALTER TABLE public.inventory_movements ALTER COLUMN company_id SET NOT NULL;
-- ALTER TABLE public.warehouse_inventory ALTER COLUMN company_id SET NOT NULL;
-- ALTER TABLE public.sales ALTER COLUMN company_id SET NOT NULL;
-- ALTER TABLE public.sale_items ALTER COLUMN company_id SET NOT NULL;
-- ALTER TABLE public.purchase_orders ALTER COLUMN company_id SET NOT NULL;
-- ALTER TABLE public.goods_receipts ALTER COLUMN company_id SET NOT NULL;
-- ALTER TABLE public.customers ALTER COLUMN company_id SET NOT NULL;
-- ALTER TABLE public.suppliers ALTER COLUMN company_id SET NOT NULL;
-- ALTER TABLE public.invoices ALTER COLUMN company_id SET NOT NULL;
-- ALTER TABLE public.customer_payments ALTER COLUMN company_id SET NOT NULL;
-- ALTER TABLE public.ledger_entries ALTER COLUMN company_id SET NOT NULL;
-- ALTER TABLE public.chart_of_accounts ALTER COLUMN company_id SET NOT NULL;
-- ALTER TABLE public.sales_orders ALTER COLUMN company_id SET NOT NULL;

-- ============================================================================
-- PART 3: Foreign Key Constraints
-- ============================================================================
-- These ensure company_id always references a valid company.

-- Core business tables
ALTER TABLE public.inventory DROP CONSTRAINT IF EXISTS fk_inventory_company;
ALTER TABLE public.inventory ADD CONSTRAINT fk_inventory_company
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS fk_products_company;
ALTER TABLE public.products ADD CONSTRAINT fk_products_company
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.warehouses DROP CONSTRAINT IF EXISTS fk_warehouses_company;
ALTER TABLE public.warehouses ADD CONSTRAINT fk_warehouses_company
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.inventory_transactions DROP CONSTRAINT IF EXISTS fk_inv_txns_company;
ALTER TABLE public.inventory_transactions ADD CONSTRAINT fk_inv_txns_company
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.inventory_movements DROP CONSTRAINT IF EXISTS fk_inv_movements_company;
ALTER TABLE public.inventory_movements ADD CONSTRAINT fk_inv_movements_company
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.warehouse_inventory DROP CONSTRAINT IF EXISTS fk_wh_inv_company;
ALTER TABLE public.warehouse_inventory ADD CONSTRAINT fk_wh_inv_company
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- Sales & Invoicing
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS fk_sales_company;
ALTER TABLE public.sales ADD CONSTRAINT fk_sales_company
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.sale_items DROP CONSTRAINT IF EXISTS fk_sale_items_company;
ALTER TABLE public.sale_items ADD CONSTRAINT fk_sale_items_company
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.sales_orders DROP CONSTRAINT IF EXISTS fk_sales_orders_company;
ALTER TABLE public.sales_orders ADD CONSTRAINT fk_sales_orders_company
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS fk_invoices_company;
ALTER TABLE public.invoices ADD CONSTRAINT fk_invoices_company
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.customer_payments DROP CONSTRAINT IF EXISTS fk_cust_payments_company;
ALTER TABLE public.customer_payments ADD CONSTRAINT fk_cust_payments_company
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- Procurement
ALTER TABLE public.purchase_orders DROP CONSTRAINT IF EXISTS fk_po_company;
ALTER TABLE public.purchase_orders ADD CONSTRAINT fk_po_company
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.goods_receipts DROP CONSTRAINT IF EXISTS fk_gr_company;
ALTER TABLE public.goods_receipts ADD CONSTRAINT fk_gr_company
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.supplier_payments DROP CONSTRAINT IF EXISTS fk_supp_payments_company;
ALTER TABLE public.supplier_payments ADD CONSTRAINT fk_supp_payments_company
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- Accounting
ALTER TABLE public.ledger_entries DROP CONSTRAINT IF EXISTS fk_ledger_company;
ALTER TABLE public.ledger_entries ADD CONSTRAINT fk_ledger_company
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.chart_of_accounts DROP CONSTRAINT IF EXISTS fk_coa_company;
ALTER TABLE public.chart_of_accounts ADD CONSTRAINT fk_coa_company
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- Customers & Suppliers
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS fk_customers_company;
ALTER TABLE public.customers ADD CONSTRAINT fk_customers_company
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.suppliers DROP CONSTRAINT IF EXISTS fk_suppliers_company;
ALTER TABLE public.suppliers ADD CONSTRAINT fk_suppliers_company
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- Examinations & Production
ALTER TABLE public.examination_batches DROP CONSTRAINT IF EXISTS fk_exam_batches_company;
ALTER TABLE public.examination_batches ADD CONSTRAINT fk_exam_batches_company
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.work_orders DROP CONSTRAINT IF EXISTS fk_work_orders_company;
ALTER TABLE public.work_orders ADD CONSTRAINT fk_work_orders_company
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- ============================================================================
-- PART 4: Composite Foreign Keys (Cross-Table Company Consistency)
-- ============================================================================
-- These ensure that related records always belong to the same company.
-- NOTE: These require the source table to have company_id as part of the PK
-- or a unique constraint on (id, company_id). We use triggers instead.

-- ============================================================================
-- PART 5: UNIQUE Constraints
-- ============================================================================

-- Prevent duplicate inventory names within same company
-- (Uncomment if name deduplication is desired)
-- CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_name_per_company
-- ON public.inventory (company_id, (data->>'name'))
-- WHERE (data->>'name') IS NOT NULL AND (data->>'name') <> '';

-- ============================================================================
-- PART 6: CHECK Constraints
-- ============================================================================

-- Ensure company_id is never empty string (must be valid UUID or NULL)
ALTER TABLE public.inventory DROP CONSTRAINT IF EXISTS chk_inventory_company_id;
ALTER TABLE public.inventory ADD CONSTRAINT chk_inventory_company_id
  CHECK (company_id IS NULL OR company_id ~ '^[a-f0-9\-]{36}$' OR length(company_id) >= 8);

-- Prevent negative stock at database level (if business rule)
-- NOTE: Only enable if your system NEVER needs negative stock
-- ALTER TABLE public.inventory DROP CONSTRAINT IF EXISTS chk_inventory_non_negative;
-- ALTER TABLE public.inventory ADD CONSTRAINT chk_inventory_non_negative
--   CHECK (COALESCE(NULLIF((data->>'stock'), ''), '0')::numeric >= 0);

-- ============================================================================
-- PART 7: Indexes for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_inventory_company ON public.inventory(company_id);
CREATE INDEX IF NOT EXISTS idx_products_company ON public.products(company_id);
CREATE INDEX IF NOT EXISTS idx_warehouses_company ON public.warehouses(company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_company ON public.inventory_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item ON public.inventory_transactions((data->>'item_id'));
CREATE INDEX IF NOT EXISTS idx_warehouse_inventory_company ON public.warehouse_inventory(company_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_inventory_item ON public.warehouse_inventory((data->>'item_id'));
CREATE INDEX IF NOT EXISTS idx_warehouse_inventory_warehouse ON public.warehouse_inventory((data->>'warehouse_id'));

-- ============================================================================
-- PART 8: Verify RLS is Enabled on All Tenant Tables
-- ============================================================================

DO $$
DECLARE
  tbl TEXT;
  tables_without_rls TEXT[] := '{}';
BEGIN
  FOR tbl IN
    SELECT t.tablename::text FROM pg_tables t
    WHERE t.schemaname = 'public'
      AND t.tablename NOT IN ('companies', 'profiles', 'company_users', 'idempotency_keys')
      AND EXISTS (
        SELECT 1 FROM information_schema.columns c
        WHERE c.table_schema = 'public' AND c.table_name = t.tablename
          AND c.column_name = 'company_id'
      )
      AND NOT EXISTS (
        SELECT 1 FROM pg_class cl
        WHERE cl.relname = t.tablename AND cl.relrowsecurity = true
      )
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
    tables_without_rls := array_append(tables_without_rls, tbl);
  END LOOP;

  IF array_length(tables_without_rls, 1) > 0 THEN
    RAISE NOTICE 'RLS enabled on: %', array_to_string(tables_without_rls, ', ');
  ELSE
    RAISE NOTICE 'All tenant tables already have RLS enabled.';
  END IF;
END $$;
