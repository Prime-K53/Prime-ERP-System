-- ============================================================================
-- RECOVERY SQL: Fix Company ID Issues
-- ============================================================================
-- IMPORTANT: Run the audit queries (02-database-audit-read-only.sql) FIRST.
-- Review the results, then uncomment and run ONLY the recovery steps needed.
-- ALL updates are wrapped in explicit transactions.
-- ============================================================================

-- ============================================================================
-- RECOVERY 1: Fix Profiles Without Company ID
-- ============================================================================
-- Before running, decide how to assign company_id:
-- Option A: Set from the user's JWT metadata
-- Option B: Set from the companies table (first company)
-- Option C: Create a new company for orphaned profiles
-- ============================================================================

-- BEFORE validation: Count profiles needing company_id
BEGIN;
SELECT 'BEFORE_R1' AS phase, COUNT(*) AS profiles_without_company
FROM public.profiles WHERE company_id IS NULL OR company_id = '';

-- Assign from JWT metadata (runs per-user via auth.users)
UPDATE public.profiles p
SET company_id = COALESCE(
  NULLIF(u.raw_user_meta_data->>'company_id', ''),
  NULLIF(u.raw_app_meta_data->>'tenant_id', ''),
  NULLIF(u.raw_app_meta_data->>'company_id', '')
), updated_at = NOW()
FROM auth.users u
WHERE u.id = p.user_id::uuid
  AND (p.company_id IS NULL OR p.company_id = '')
  AND (
    NULLIF(u.raw_user_meta_data->>'company_id', '') IS NOT NULL
    OR NULLIF(u.raw_app_meta_data->>'tenant_id', '') IS NOT NULL
    OR NULLIF(u.raw_app_meta_data->>'company_id', '') IS NOT NULL
  );

-- AFTER validation: remaining blanks need manual intervention
SELECT 'AFTER_R1' AS phase, COUNT(*) AS still_no_company
FROM public.profiles WHERE company_id IS NULL OR company_id = '';

SELECT 'REMAINING_R1' AS phase, id, user_id, full_name
FROM public.profiles WHERE company_id IS NULL OR company_id = '';

COMMIT;

-- ============================================================================
-- RECOVERY 2: Fix Inventory Without Company ID
-- ============================================================================
-- For each orphan inventory item, derive company_id from:
-- 1. The JSONB data->>'company_id'
-- 2. The warehouse_inventory it belongs to
-- 3. The transactions that reference it
-- ============================================================================

BEGIN;

-- BEFORE validation
SELECT 'BEFORE_R2' AS phase, COUNT(*) AS inventory_without_company
FROM public.inventory WHERE company_id IS NULL OR company_id = '';

-- Fix: Copy company_id from JSONB data field if present
UPDATE public.inventory i
SET company_id = (i.data->>'company_id'), updated_at = NOW()
WHERE (i.company_id IS NULL OR i.company_id = '')
  AND (i.data->>'company_id') IS NOT NULL
  AND (i.data->>'company_id') <> '';

-- Fix: Derive from warehouse_inventory records
UPDATE public.inventory i
SET company_id = wi.company_id, updated_at = NOW()
FROM public.warehouse_inventory wi
WHERE (i.company_id IS NULL OR i.company_id = '')
  AND (wi.data->>'inventory_id' = i.id OR wi.data->>'item_id' = i.id)
  AND wi.company_id IS NOT NULL AND wi.company_id <> '';

-- Fix: Derive from inventory_transactions
UPDATE public.inventory i
SET company_id = t.company_id, updated_at = NOW()
FROM public.inventory_transactions t
WHERE (i.company_id IS NULL OR i.company_id = '')
  AND (t.data->>'item_id' = i.id OR t.data->>'inventory_id' = i.id)
  AND t.company_id IS NOT NULL AND t.company_id <> '';

-- AFTER validation
SELECT 'AFTER_R2' AS phase, COUNT(*) AS still_no_company
FROM public.inventory WHERE company_id IS NULL OR company_id = '';

SELECT 'REMAINING_R2' AS phase, id, (data->>'name') AS item_name
FROM public.inventory WHERE company_id IS NULL OR company_id = '';

COMMIT;

-- ============================================================================
-- RECOVERY 3: Fix Products Without Company ID
-- ============================================================================

BEGIN;

SELECT 'BEFORE_R3' AS phase, COUNT(*) AS products_without_company
FROM public.products WHERE company_id IS NULL OR company_id = '';

UPDATE public.products p
SET company_id = COALESCE(
  NULLIF((p.data->>'company_id'), ''),
  (SELECT i.company_id FROM public.inventory i
   WHERE i.id = p.id OR (i.data->>'product_id') = p.id
   LIMIT 1)
), updated_at = NOW()
WHERE (p.company_id IS NULL OR p.company_id = '');

SELECT 'AFTER_R3' AS phase, COUNT(*) AS still_no_company
FROM public.products WHERE company_id IS NULL OR company_id = '';

COMMIT;

-- ============================================================================
-- RECOVERY 4: Fix Warehouses Without Company ID
-- ============================================================================

BEGIN;

SELECT 'BEFORE_R4' AS phase, COUNT(*) AS warehouses_without_company
FROM public.warehouses WHERE company_id IS NULL OR company_id = '';

UPDATE public.warehouses w
SET company_id = COALESCE(
  NULLIF((w.data->>'company_id'), ''),
  (SELECT wi.company_id FROM public.warehouse_inventory wi
   WHERE wi.company_id IS NOT NULL AND wi.company_id <> ''
   AND (wi.data->>'warehouse_id') = w.id
   LIMIT 1)
), updated_at = NOW()
WHERE (w.company_id IS NULL OR w.company_id = '');

SELECT 'AFTER_R4' AS phase, COUNT(*) AS still_no_company
FROM public.warehouses WHERE company_id IS NULL OR company_id = '';

COMMIT;

-- ============================================================================
-- RECOVERY 5: Fix InventoryTransactions Without Company ID
-- ============================================================================

BEGIN;

SELECT 'BEFORE_R5' AS phase, COUNT(*) AS txns_without_company
FROM public.inventory_transactions WHERE company_id IS NULL OR company_id = '';

UPDATE public.inventory_transactions t
SET company_id = COALESCE(
  NULLIF((t.data->>'company_id'), ''),
  (SELECT i.company_id FROM public.inventory i
   WHERE i.id = (t.data->>'item_id') OR i.id = (t.data->>'inventory_id')
   LIMIT 1)
), updated_at = NOW()
WHERE (t.company_id IS NULL OR t.company_id = '');

SELECT 'AFTER_R5' AS phase, COUNT(*) AS still_no_company
FROM public.inventory_transactions WHERE company_id IS NULL OR company_id = '';

COMMIT;

-- ============================================================================
-- RECOVERY 6: Fix Cross-Company Inventory
-- ============================================================================
-- If inventory items with the same name exist in multiple companies,
-- determine the correct owner and remove the duplicate.
-- NOTE: This is a MANUAL REVIEW step. The query identifies duplicates.
-- ============================================================================

-- Identify duplicates (read-only)
BEGIN;
SELECT 'R6_DUPLICATES' AS phase,
  (data->>'name') AS item_name,
  array_agg(id) AS item_ids,
  array_agg(company_id) AS company_ids,
  COUNT(*) AS occurrences
FROM public.inventory
GROUP BY (data->>'name')
HAVING COUNT(*) > 1 AND COUNT(DISTINCT company_id) > 1;

-- For items that should belong to ONE company but exist in MULTIPLE,
-- merge by updating transactions to point to the canonical record.
-- Example (ADAPT IDs TO YOUR ACTUAL DATA):
-- UPDATE public.inventory_transactions t
-- SET data = jsonb_set(data, '{item_id}', '"<CANONICAL_ID>"')
-- WHERE (t.data->>'item_id') IN ('<DUP_ID_1>', '<DUP_ID_2>');
--
-- Then delete the duplicate:
-- DELETE FROM public.inventory WHERE id IN ('<DUP_ID_1>', '<DUP_ID_2>')
--   AND id != '<CANONICAL_ID>';
COMMIT;

-- ============================================================================
-- RECOVERY 7: Fix Cross-Company References in Sales/Purchases
-- ============================================================================

-- Fix sale_items referencing products from different company
BEGIN;
SELECT 'BEFORE_R7' AS phase, COUNT(*) AS cross_company_sale_items
FROM public.sale_items si
LEFT JOIN public.products p ON p.id = (si.data->>'product_id')
WHERE si.company_id IS DISTINCT FROM p.company_id
  AND p.id IS NOT NULL;

-- For each mismatched sale_item, update its company_id to match the product
UPDATE public.sale_items si
SET company_id = p.company_id, updated_at = NOW()
FROM public.products p
WHERE p.id = (si.data->>'product_id')
  AND si.company_id IS DISTINCT FROM p.company_id;

SELECT 'AFTER_R7' AS phase, COUNT(*) AS remaining_cross_company_sale_items
FROM public.sale_items si
LEFT JOIN public.products p ON p.id = (si.data->>'product_id')
WHERE si.company_id IS DISTINCT FROM p.company_id
  AND p.id IS NOT NULL;
COMMIT;

-- ============================================================================
-- RECOVERY 8: Final Integrity Validation
-- ============================================================================
-- Run this after all recovery steps to confirm everything is clean.
-- ============================================================================

SELECT 'FINAL_VALIDATION' AS phase;

-- All tables should have zero orphan/null company_id records
SELECT 'profiles' AS tbl, COUNT(*) AS null_company
FROM public.profiles WHERE company_id IS NULL OR company_id = ''
UNION ALL
SELECT 'inventory', COUNT(*) FROM public.inventory WHERE company_id IS NULL OR company_id = ''
UNION ALL
SELECT 'products', COUNT(*) FROM public.products WHERE company_id IS NULL OR company_id = ''
UNION ALL
SELECT 'warehouses', COUNT(*) FROM public.warehouses WHERE company_id IS NULL OR company_id = ''
UNION ALL
SELECT 'inventory_transactions', COUNT(*) FROM public.inventory_transactions WHERE company_id IS NULL OR company_id = ''
UNION ALL
SELECT 'sales', COUNT(*) FROM public.sales WHERE company_id IS NULL OR company_id = ''
UNION ALL
SELECT 'purchase_orders', COUNT(*) FROM public.purchase_orders WHERE company_id IS NULL OR company_id = ''
UNION ALL
SELECT 'goods_receipts', COUNT(*) FROM public.goods_receipts WHERE company_id IS NULL OR company_id = ''
UNION ALL
SELECT 'customers', COUNT(*) FROM public.customers WHERE company_id IS NULL OR company_id = ''
UNION ALL
SELECT 'suppliers', COUNT(*) FROM public.suppliers WHERE company_id IS NULL OR company_id = ''
UNION ALL
SELECT 'invoices', COUNT(*) FROM public.invoices WHERE company_id IS NULL OR company_id = ''
UNION ALL
SELECT 'customer_payments', COUNT(*) FROM public.customer_payments WHERE company_id IS NULL OR company_id = ''
UNION ALL
SELECT 'chart_of_accounts', COUNT(*) FROM public.chart_of_accounts WHERE company_id IS NULL OR company_id = ''
UNION ALL
SELECT 'ledger_entries', COUNT(*) FROM public.ledger_entries WHERE company_id IS NULL OR company_id = ''
ORDER BY tbl;
