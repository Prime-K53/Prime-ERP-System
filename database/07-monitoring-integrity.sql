-- ============================================================================
-- MONITORING: Automated Integrity Checks
-- ============================================================================
-- Run these regularly (e.g., via pg_cron or a scheduled edge function) to
-- detect company_id mismatches, orphan records, and data corruption.
-- ============================================================================

-- ============================================================================
-- PART 1: Integrity Check Function (Returns All Issues as a Report)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_company_integrity()
RETURNS TABLE (
  check_name TEXT,
  severity TEXT,
  affected_table TEXT,
  issue_count BIGINT,
  details TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. NULL company_id checks
  RETURN QUERY
  SELECT
    'null_company_id'::TEXT,
    'critical'::TEXT,
    t.tablename::TEXT,
    COUNT(*)::BIGINT,
    format('Table %I has records with NULL or empty company_id', t.tablename)
  FROM pg_tables t
  CROSS JOIN LATERAL (
    EXECUTE format('SELECT 1 FROM %I WHERE company_id IS NULL OR company_id = '''' LIMIT 1', t.tablename)
  ) sub(q)
  WHERE t.schemaname = 'public'
    AND EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = t.tablename
        AND c.column_name = 'company_id'
    )
    AND t.tablename NOT IN ('companies', 'company_users', 'idempotency_keys')
  GROUP BY t.tablename
  HAVING COUNT(*) > 0;

  -- 2. Invalid company_id (no matching company)
  RETURN QUERY
  SELECT
    'invalid_company_id'::TEXT,
    'critical'::TEXT,
    t.tablename::TEXT,
    COUNT(*)::BIGINT,
    format('Table %I references non-existent companies', t.tablename)
  FROM pg_tables t
  CROSS JOIN LATERAL (
    EXECUTE format('SELECT 1 FROM %I WHERE company_id IS NOT NULL AND company_id <> ''''
      AND NOT EXISTS (SELECT 1 FROM companies c WHERE c.id = %I.company_id) LIMIT 1',
      t.tablename, t.tablename)
  ) sub(q)
  WHERE t.schemaname = 'public'
    AND EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = t.tablename
        AND c.column_name = 'company_id'
    )
    AND t.tablename NOT IN ('companies', 'company_users', 'idempotency_keys')
  GROUP BY t.tablename
  HAVING COUNT(*) > 0;

  -- 3. Inventory without transactions
  RETURN QUERY
  SELECT
    'inventory_no_transactions'::TEXT,
    'warning'::TEXT,
    'inventory'::TEXT,
    COUNT(*)::BIGINT,
    'Inventory items with zero transactions (may be incomplete data)'
  FROM public.inventory i
  WHERE NOT EXISTS (
    SELECT 1 FROM public.inventory_transactions t
    WHERE (t.data->>'item_id') = i.id OR (t.data->>'inventory_id') = i.id
  )
  AND (i.data->>'stock') IS NOT NULL
  AND NULLIF((i.data->>'stock'), '')::numeric > 0;

  -- 4. Duplicate inventory names within company
  RETURN QUERY
  SELECT
    'duplicate_inventory_names'::TEXT,
    'warning'::TEXT,
    'inventory'::TEXT,
    COUNT(*)::BIGINT,
    format('Item "%s" has %s copies in company %s',
      (data->>'name'), cnt::TEXT, company_id)
  FROM (
    SELECT company_id, (data->>'name') AS item_name, COUNT(*) AS cnt
    FROM public.inventory
    WHERE (data->>'name') IS NOT NULL AND (data->>'name') <> ''
    GROUP BY company_id, (data->>'name')
    HAVING COUNT(*) > 1
  ) dups
  GROUP BY company_id, item_name, cnt;

  -- 5. Warehouse-inventory company mismatch
  RETURN QUERY
  SELECT
    'wh_inv_company_mismatch'::TEXT,
    'critical'::TEXT,
    'warehouse_inventory'::TEXT,
    COUNT(*)::BIGINT,
    'warehouse_inventory company_id differs from referenced inventory item'
  FROM public.warehouse_inventory wi
  JOIN public.inventory i ON i.id = (wi.data->>'item_id') OR i.id = (wi.data->>'inventory_id')
  WHERE wi.company_id IS DISTINCT FROM i.company_id;

  -- 6. Transaction-inventory company mismatch
  RETURN QUERY
  SELECT
    'txn_inv_company_mismatch'::TEXT,
    'critical'::TEXT,
    'inventory_transactions'::TEXT,
    COUNT(*)::BIGINT,
    'Transaction company_id differs from referenced inventory item'
  FROM public.inventory_transactions t
  JOIN public.inventory i ON i.id = (t.data->>'item_id') OR i.id = (t.data->>'inventory_id')
  WHERE t.company_id IS DISTINCT FROM i.company_id;

  -- 7. Products assigned to multiple companies (same name)
  RETURN QUERY
  SELECT
    'product_cross_company'::TEXT,
    'warning'::TEXT,
    'products'::TEXT,
    COUNT(*)::BIGINT,
    format('Product "%s" exists in %s companies', (data->>'name'), COUNT(DISTINCT company_id)::TEXT)
  FROM public.products
  WHERE (data->>'name') IS NOT NULL AND (data->>'name') <> ''
  GROUP BY (data->>'name')
  HAVING COUNT(DISTINCT company_id) > 1;

  -- 8. Orphan user profiles (no company_users entry)
  RETURN QUERY
  SELECT
    'orphan_profiles'::TEXT,
    'warning'::TEXT,
    'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'Profiles without corresponding company_users entry'
  FROM public.profiles p
  WHERE p.company_id IS NOT NULL AND p.company_id <> ''
    AND p.user_id IS NOT NULL AND p.user_id <> ''
    AND NOT EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.user_id = p.user_id::uuid AND cu.company_id = p.company_id
    );

  -- 9. RLS policy gaps
  RETURN QUERY
  SELECT
    'rls_policy_gaps'::TEXT,
    'critical'::TEXT,
    t.tablename::TEXT,
    1::BIGINT,
    format('Table %I has RLS enabled but no policies', t.tablename)
  FROM pg_tables t
  JOIN pg_class c ON c.relname = t.tablename
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.schemaname
  WHERE t.schemaname = 'public'
    AND c.relrowsecurity = true
    AND EXISTS (
      SELECT 1 FROM information_schema.columns col
      WHERE col.table_schema = 'public' AND col.table_name = t.tablename
        AND col.column_name = 'company_id'
    )
    AND NOT EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = 'public' AND p.tablename = t.tablename
    );
END;
$$;

-- ============================================================================
-- PART 2: Quick Health Check (Lightweight)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.quick_tenant_health()
RETURNS TABLE (
  metric TEXT,
  value TEXT
)
LANGUAGE sql
STABLE
AS $$
  SELECT 'total_companies'::TEXT, COUNT(*)::TEXT FROM public.companies
  UNION ALL
  SELECT 'total_company_users', COUNT(*)::TEXT FROM public.company_users
  UNION ALL
  SELECT 'profiles_no_company', COUNT(*)::TEXT FROM public.profiles WHERE company_id IS NULL OR company_id = ''
  UNION ALL
  SELECT 'inventory_no_company', COUNT(*)::TEXT FROM public.inventory WHERE company_id IS NULL OR company_id = ''
  UNION ALL
  SELECT 'products_no_company', COUNT(*)::TEXT FROM public.products WHERE company_id IS NULL OR company_id = ''
  UNION ALL
  SELECT 'warehouses_no_company', COUNT(*)::TEXT FROM public.warehouses WHERE company_id IS NULL OR company_id = ''
  UNION ALL
  SELECT 'txns_no_company', COUNT(*)::TEXT FROM public.inventory_transactions WHERE company_id IS NULL OR company_id = ''
  UNION ALL
  SELECT 'users_without_company', COUNT(*)::TEXT
  FROM auth.users u
  WHERE NOT EXISTS (SELECT 1 FROM public.company_users cu WHERE cu.user_id = u.id)
    AND u.raw_user_meta_data->>'company_id' IS NULL
  UNION ALL
  SELECT 'rls_status', CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'GAPS' END
  FROM pg_tables t
  JOIN pg_class c ON c.relname = t.tablename
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.schemaname
  WHERE t.schemaname = 'public'
    AND c.relrowsecurity = true
    AND EXISTS (
      SELECT 1 FROM information_schema.columns col
      WHERE col.table_schema = 'public' AND col.table_name = t.tablename AND col.column_name = 'company_id'
    )
    AND NOT EXISTS (
      SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = t.tablename
    );
$$;

-- ============================================================================
-- PART 3: pg_cron Integration (If Available)
-- ============================================================================
-- Schedule daily integrity check:
/*
SELECT cron.schedule(
  'daily-company-integrity-check',
  '0 6 * * *',  -- Every day at 6:00 AM
  $$SELECT public.check_company_integrity()$$
);
*/
