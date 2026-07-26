-- ============================================================================
-- DATABASE AUDIT: Company ID Integrity Checks
-- ============================================================================
-- These queries are READ-ONLY and safe to run in production.
-- Run each section and capture results BEFORE making any changes.
-- ============================================================================

-- ============================================================================
-- SECTION 1: Company & Profile Health
-- ============================================================================

-- 1a. Profiles without a company_id
SELECT '1a - Profiles without company_id' AS check_name, COUNT(*) AS issue_count
FROM public.profiles
WHERE company_id IS NULL OR company_id = '';

-- 1b. Profiles linked to non-existent companies
SELECT '1b - Profiles with invalid company_id' AS check_name, p.id, p.user_id, p.company_id
FROM public.profiles p
WHERE p.company_id IS NOT NULL AND p.company_id <> ''
  AND NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = p.company_id);

-- 1c. Orphan companies (no profiles)
SELECT '1c - Companies without any profile' AS check_name, c.id, c.company_name
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.company_id = c.id);

-- 1d. Users with multiple profiles (should be impossible due to UNIQUE(user_id))
SELECT '1d - Users with multiple profiles' AS check_name, user_id, COUNT(*) AS profile_count
FROM public.profiles
GROUP BY user_id
HAVING COUNT(*) > 1;

-- ============================================================================
-- SECTION 2: Inventory Integrity
-- ============================================================================

-- 2a. Inventory without company_id
SELECT '2a - Inventory without company_id' AS check_name, COUNT(*) AS issue_count
FROM public.inventory
WHERE company_id IS NULL OR company_id = '';

-- 2b. Inventory linked to non-existent company
SELECT '2b - Inventory with invalid company_id' AS check_name, i.id, i.company_id, (i.data->>'name') AS item_name
FROM public.inventory i
WHERE i.company_id IS NOT NULL AND i.company_id <> ''
  AND NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = i.company_id);

-- 2c. Inventory whose company differs from the data->>'company_id' inside JSONB
-- This detects records where the JSONB data field has a different company_id
SELECT '2c - Inventory with mismatched JSONB company_id' AS check_name, i.id,
  i.company_id AS column_company_id,
  (i.data->>'company_id') AS jsonb_company_id,
  (i.data->>'name') AS item_name
FROM public.inventory i
WHERE i.company_id IS DISTINCT FROM (i.data->>'company_id')
  AND (i.data->>'company_id') IS NOT NULL
  AND (i.data->>'company_id') <> '';

-- 2d. Duplicate inventory by name within same company
SELECT '2d - Duplicate inventory names in same company' AS check_name,
  company_id, (data->>'name') AS item_name, COUNT(*) AS duplicate_count
FROM public.inventory
WHERE (data->>'name') IS NOT NULL AND (data->>'name') <> ''
GROUP BY company_id, (data->>'name')
HAVING COUNT(*) > 1;

-- 2e. Inventory items that have no corresponding inventory_transactions
SELECT '2e - Inventory with zero transactions' AS check_name, COUNT(*) AS issue_count
FROM public.inventory i
WHERE NOT EXISTS (
  SELECT 1 FROM public.inventory_transactions it
  WHERE (it.data->>'item_id') = i.id OR (it.data->>'inventory_id') = i.id
);

-- 2f. Inventory linked to multiple companies (cross-company data)
SELECT '2f - Inventory items shared across companies' AS check_name,
  (data->>'name') AS item_name, COUNT(DISTINCT company_id) AS company_count,
  array_agg(DISTINCT company_id) AS company_ids
FROM public.inventory
GROUP BY (data->>'name')
HAVING COUNT(DISTINCT company_id) > 1;

-- ============================================================================
-- SECTION 3: Product Integrity
-- ============================================================================

-- 3a. Products without company_id
SELECT '3a - Products without company_id' AS check_name, COUNT(*) AS issue_count
FROM public.products
WHERE company_id IS NULL OR company_id = '';

-- 3b. Products linked to non-existent company
SELECT '3b - Products with invalid company_id' AS check_name, p.id, p.company_id, (p.data->>'name') AS product_name
FROM public.products p
WHERE p.company_id IS NOT NULL AND p.company_id <> ''
  AND NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = p.company_id);

-- 3c. Products where company_id != inventory company_id (by matching name)
SELECT '3c - Product-inventory company mismatch' AS check_name,
  p.id AS product_id, (p.data->>'name') AS product_name,
  p.company_id AS product_company,
  i.id AS inventory_id, i.company_id AS inventory_company
FROM public.products p
JOIN public.inventory i ON (i.data->>'name') = (p.data->>'name')
WHERE p.company_id IS DISTINCT FROM i.company_id;

-- ============================================================================
-- SECTION 4: Warehouse Integrity
-- ============================================================================

-- 4a. Warehouses without company_id
SELECT '4a - Warehouses without company_id' AS check_name, COUNT(*) AS issue_count
FROM public.warehouses
WHERE company_id IS NULL OR company_id = '';

-- 4b. Warehouses linked to non-existent company
SELECT '4b - Warehouses with invalid company_id' AS check_name, w.id, w.company_id, (w.data->>'name') AS warehouse_name
FROM public.warehouses w
WHERE w.company_id IS NOT NULL AND w.company_id <> ''
  AND NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = w.company_id);

-- 4c. Warehouse-Inventory company mismatch
SELECT '4c - Warehouse-inventory company mismatch' AS check_name,
  wi.id AS wi_id,
  wi.company_id AS wi_company,
  i.company_id AS inventory_company,
  (i.data->>'name') AS item_name
FROM public.warehouse_inventory wi
JOIN public.inventory i ON i.id = (wi.data->>'inventory_id') OR i.id = (wi.data->>'item_id')
WHERE wi.company_id IS DISTINCT FROM i.company_id;

-- ============================================================================
-- SECTION 5: Inventory Transaction Integrity
-- ============================================================================

-- 5a. Transactions without company_id
SELECT '5a - Transactions without company_id' AS check_name, COUNT(*) AS issue_count
FROM public.inventory_transactions
WHERE company_id IS NULL OR company_id = '';

-- 5b. Transactions whose company differs from inventory item's company
SELECT '5b - Transaction-inventory company mismatch' AS check_name,
  t.id AS transaction_id, t.company_id AS txn_company,
  i.id AS inventory_id, i.company_id AS inventory_company
FROM public.inventory_transactions t
LEFT JOIN public.inventory i ON (i.id = (t.data->>'item_id') OR i.id = (t.data->>'inventory_id'))
WHERE t.company_id IS DISTINCT FROM i.company_id
  AND i.id IS NOT NULL;

-- 5c. Transactions referencing non-existent inventory
SELECT '5c - Orphan transactions' AS check_name, t.id AS transaction_id,
  (t.data->>'item_id') AS referenced_item_id,
  t.company_id
FROM public.inventory_transactions t
WHERE (t.data->>'item_id') IS NOT NULL AND (t.data->>'item_id') <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.inventory i
    WHERE i.id = (t.data->>'item_id')
  );

-- ============================================================================
-- SECTION 6: Cross-Company Reference Detection (Broader)
-- ============================================================================

-- 6a. Sales referencing products from different company
SELECT '6a - Sale-product company mismatch' AS check_name,
  s.id AS sale_id, s.company_id AS sale_company,
  (si.data->>'product_id') AS product_id,
  p.company_id AS product_company
FROM public.sales s
JOIN public.sale_items si ON (si.data->>'sale_id') = s.id OR si.company_id = s.company_id
LEFT JOIN public.products p ON p.id = (si.data->>'product_id')
WHERE s.company_id IS DISTINCT FROM p.company_id
  AND p.id IS NOT NULL;

-- 6b. Goods receipts referencing purchases from different company
SELECT '6b - GR-PO company mismatch' AS check_name,
  gr.id AS gr_id, gr.company_id AS gr_company,
  po.id AS po_id, po.company_id AS po_company
FROM public.goods_receipts gr
LEFT JOIN public.purchase_orders po ON po.id = (gr.data->>'purchase_order_id')
WHERE gr.company_id IS DISTINCT FROM po.company_id
  AND po.id IS NOT NULL;

-- 6c. Customer payments referencing invoices from different company
SELECT '6c - Payment-invoice company mismatch' AS check_name,
  cp.id AS payment_id, cp.company_id AS payment_company,
  inv.id AS invoice_id, inv.company_id AS invoice_company
FROM public.customer_payments cp
LEFT JOIN public.invoices inv ON inv.id = (cp.data->>'invoice_id')
WHERE cp.company_id IS DISTINCT FROM inv.company_id
  AND inv.id IS NOT NULL;

-- ============================================================================
-- SECTION 7: Schema Completeness
-- ============================================================================

-- 7a. Tables with RLS enabled but NO policies (security gap)
SELECT '7a - Tables with RLS but no policies' AS check_name,
  schemaname, tablename
FROM pg_tables t
WHERE EXISTS (
  SELECT 1 FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relname = t.tablename AND n.nspname = t.schemaname
    AND c.relrowsecurity = true
) AND t.schemaname = 'public'
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = t.schemaname AND p.tablename = t.tablename
  );

-- 7b. Tables WITHOUT RLS enabled (sensitive data exposed)
SELECT '7b - Tables without RLS' AS check_name,
  schemaname, tablename
FROM pg_tables t
WHERE t.schemaname = 'public'
  AND NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = t.tablename AND n.nspname = t.schemaname
      AND c.relrowsecurity = true
  )
  AND t.tablename NOT LIKE 'pg_%'
  AND t.tablename NOT LIKE '_prisma_%';

-- 7c. Tables missing company_id column
SELECT '7c - Tables missing company_id column' AS check_name,
  t.schemaname, t.tablename
FROM pg_tables t
WHERE t.schemaname = 'public'
  AND t.tablename NOT IN ('companies', 'profiles', 'idempotency_keys', 'schema_migrations', '_prisma_migrations')
  AND t.tablename NOT LIKE 'pg_%'
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = t.schemaname
      AND c.table_name = t.tablename
      AND c.column_name = 'company_id'
  );

-- ============================================================================
-- SECTION 8: Stock Integrity
-- ============================================================================

-- 8a. Inventory with negative stock (if prohibited)
SELECT '8a - Negative stock items' AS check_name,
  i.id, (i.data->>'name') AS item_name, i.company_id,
  (i.data->>'stock') AS stock,
  (i.data->>'quantity') AS quantity
FROM public.inventory i
WHERE COALESCE(NULLIF((i.data->>'stock'), '')::numeric, 0) < 0
   OR COALESCE(NULLIF((i.data->>'quantity'), '')::numeric, 0) < 0;

-- 8b. Warehouse inventory with negative stock
SELECT '8b - Negative warehouse stock' AS check_name,
  wi.id, wi.company_id, (wi.data->>'quantity')::numeric AS quantity,
  (wi.data->>'item_id') AS item_id
FROM public.warehouse_inventory wi
WHERE COALESCE(NULLIF((wi.data->>'quantity'), '')::numeric, 0) < 0;

-- ============================================================================
-- REPORT SUMMARY
-- ============================================================================
SELECT 'AUDIT COMPLETE' AS status,
  'Run each section above separately and inspect results.' AS instructions;
