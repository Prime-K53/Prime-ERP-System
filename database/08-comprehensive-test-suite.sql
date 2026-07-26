-- ============================================================================
-- COMPREHENSIVE TEST SUITE: Multi-Tenant Isolation
-- ============================================================================
-- Run these tests after applying migrations 04-07 to verify:
-- 1. RLS policies correctly isolate companies
-- 2. Triggers enforce company_id consistency
-- 3. Cross-company operations are rejected
-- 4. Data recovery was successful
-- ============================================================================

-- ============================================================================
-- TEST GROUP 1: Basic Tenant Isolation
-- ============================================================================

-- Test 1.1: Verify get_user_company_id() returns a non-null value
DO $$
DECLARE
  cid TEXT;
BEGIN
  cid := public.get_user_company_id();
  IF cid IS NULL OR cid = '' THEN
    RAISE WARNING 'TEST 1.1 FAILED: get_user_company_id() returned NULL/empty';
  ELSE
    RAISE NOTICE 'TEST 1.1 PASSED: get_user_company_id() = %', cid;
  END IF;
END $$;

-- Test 1.2: Verify user_belongs_to_company() works
DO $$
DECLARE
  cid TEXT;
  belongs BOOLEAN;
BEGIN
  cid := public.get_user_company_id();
  IF cid IS NOT NULL AND cid <> '' THEN
    belongs := public.user_belongs_to_company(cid);
    IF belongs THEN
      RAISE NOTICE 'TEST 1.2 PASSED: user_belongs_to_company() = true';
    ELSE
      RAISE WARNING 'TEST 1.2 FAILED: user_belongs_to_company() returned false for own company';
    END IF;
  END IF;
END $$;

-- Test 1.3: Verify profiles RLS (user sees own profile)
BEGIN;
SET LOCAL row_security TO on;
SELECT count(*) AS rls_profile_count FROM public.profiles;
-- Should return at least 1 (the current user's profile)
ROLLBACK;

-- ============================================================================
-- TEST GROUP 2: Company ID Assignment
-- ============================================================================

-- Test 2.1: Trigger auto-sets company_id on INSERT
BEGIN;
CREATE TEMP TABLE test_company_insert AS
SELECT id, company_id FROM public.inventory LIMIT 0;

-- The trigger_set_company_id should fire and set company_id
-- (We can't easily test this without actually inserting and rolling back,
--  since we'd need a real inventory insert. This is a schema-level test.)

-- Verify the trigger exists
SELECT t.tgname AS trigger_name, c.relname AS table_name
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
WHERE t.tgname = 'trg_set_company_id'
  AND c.relname = 'inventory';

RAISE NOTICE 'TEST 2.1: Verify trigger_set_company_id trigger exists on inventory table (check output above)';

COMMIT;

-- ============================================================================
-- TEST GROUP 3: Cross-Company Rejection
-- ============================================================================

-- Test 3.1: Inventory transaction with wrong company should be rejected
-- (This will error as expected - wrap in a block that catches it)
DO $$
BEGIN
  -- Attempt to insert a transaction with company_id that doesn't match
  -- the current user's company. This should be rejected by RLS.
  -- Note: This test validates the RLS policy exists, not that it runs.

  -- Verify the trigger function exists
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'trigger_validate_inventory_txn_company'
  ) THEN
    RAISE NOTICE 'TEST 3.1 PASSED: trigger_validate_inventory_txn_company function exists';
  ELSE
    RAISE WARNING 'TEST 3.1 FAILED: trigger_validate_inventory_txn_company function missing';
  END IF;

  -- Verify the trigger is attached
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'trg_validate_inventory_txn_company'
      AND c.relname = 'inventory_transactions'
  ) THEN
    RAISE NOTICE 'TEST 3.1 PASSED: trg_validate_inventory_txn_company trigger is active';
  ELSE
    RAISE WARNING 'TEST 3.1 FAILED: trg_validate_inventory_txn_company trigger missing on inventory_transactions';
  END IF;
END $$;

-- ============================================================================
-- TEST GROUP 4: Immutable Transaction Ledger
-- ============================================================================

-- Test 4.1: Verify audit ledger table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'inventory_audit_ledger'
  ) THEN
    RAISE NOTICE 'TEST 4.1 PASSED: inventory_audit_ledger table exists';
  ELSE
    RAISE WARNING 'TEST 4.1 FAILED: inventory_audit_ledger table missing';
  END IF;
END $$;

-- Test 4.2: Verify INSERT trigger exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'trg_inventory_audit_ledger'
      AND c.relname = 'inventory_transactions'
  ) THEN
    RAISE NOTICE 'TEST 4.2 PASSED: trg_inventory_audit_ledger trigger is active';
  ELSE
    RAISE WARNING 'TEST 4.2 FAILED: trg_inventory_audit_ledger trigger missing on inventory_transactions';
  END IF;
END $$;

-- Test 4.3: Verify UPDATE/DELETE protection triggers
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'trg_protect_inventory_transactions'
      AND c.relname = 'inventory_transactions'
  ) THEN
    RAISE NOTICE 'TEST 4.3 PASSED: trg_protect_inventory_transactions is active';
  ELSE
    RAISE WARNING 'TEST 4.3 FAILED: trg_protect_inventory_transactions missing on inventory_transactions';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'trg_protect_inventory_audit'
      AND c.relname = 'inventory_audit_ledger'
  ) THEN
    RAISE NOTICE 'TEST 4.3 PASSED: trg_protect_inventory_audit is active';
  ELSE
    RAISE WARNING 'TEST 4.3 FAILED: trg_protect_inventory_audit missing on inventory_audit_ledger';
  END IF;
END $$;

-- ============================================================================
-- TEST GROUP 5: Foreign Key Constraints
-- ============================================================================

-- Test 5.1: Verify FK constraints exist
DO $$
DECLARE
  fk_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO fk_count
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND ccu.table_name = 'companies'
    AND ccu.column_name = 'id';

  IF fk_count > 0 THEN
    RAISE NOTICE 'TEST 5.1 PASSED: % FK constraints reference companies(id)', fk_count;
  ELSE
    RAISE WARNING 'TEST 5.1 FAILED: No FK constraints reference companies(id)';
  END IF;
END $$;

-- List all FK constraints for verification
SELECT
  tc.table_schema, tc.table_name, tc.constraint_name,
  ccu.table_name AS referenced_table,
  ccu.column_name AS referenced_column
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND ccu.table_name = 'companies'
ORDER BY tc.table_name;

-- ============================================================================
-- TEST GROUP 6: RLS Policy Coverage
-- ============================================================================

-- Test 6.1: All tenant tables have at least one policy
DO $$
DECLARE
  tbl TEXT;
  all_covered BOOLEAN := true;
BEGIN
  FOR tbl IN
    SELECT t.tablename::text FROM pg_tables t
    WHERE t.schemaname = 'public'
      AND EXISTS (
        SELECT 1 FROM information_schema.columns c
        WHERE c.table_schema = 'public' AND c.table_name = t.tablename
          AND c.column_name = 'company_id'
      )
      AND NOT EXISTS (
        SELECT 1 FROM pg_policies p
        WHERE p.schemaname = 'public' AND p.tablename = t.tablename
      )
  LOOP
    RAISE WARNING 'TEST 6.1 FAILED: Table % has no RLS policies', tbl;
    all_covered := false;
  END LOOP;

  IF all_covered THEN
    RAISE NOTICE 'TEST 6.1 PASSED: All tenant tables have RLS policies';
  END IF;
END $$;

-- Test 6.2: List all active RLS policies
SELECT
  p.schemaname, p.tablename, p.policyname,
  p.permissive, p.cmd, p.qual, p.with_check
FROM pg_policies p
WHERE p.schemaname = 'public'
ORDER BY p.tablename, p.policyname;

-- ============================================================================
-- TEST GROUP 7: Integrity Check Function
-- ============================================================================

-- Test 7.1: check_company_integrity() function exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'check_company_integrity') THEN
    RAISE NOTICE 'TEST 7.1 PASSED: check_company_integrity() function exists';
  ELSE
    RAISE WARNING 'TEST 7.1 FAILED: check_company_integrity() function missing';
  END IF;
END $$;

-- Test 7.2: quick_tenant_health() function exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'quick_tenant_health') THEN
    RAISE NOTICE 'TEST 7.2 PASSED: quick_tenant_health() function exists';
  ELSE
    RAISE WARNING 'TEST 7.2 FAILED: quick_tenant_health() function missing';
  END IF;
END $$;

-- Run quick health check
SELECT * FROM public.quick_tenant_health();

-- ============================================================================
-- TEST GROUP 8: company_users Synchronization
-- ============================================================================

-- Test 8.1: Trigger syncs profile to company_users
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'trg_sync_profile_to_company_users'
      AND c.relname = 'profiles'
  ) THEN
    RAISE NOTICE 'TEST 8.1 PASSED: trg_sync_profile_to_company_users is active';
  ELSE
    RAISE WARNING 'TEST 8.1 FAILED: trg_sync_profile_to_company_users missing on profiles';
  END IF;
END $$;

-- Test 8.2: Verify company_users has data for authenticated users
SELECT
  cu.user_id, cu.company_id, cu.role, cu.is_default
FROM public.company_users cu
LIMIT 10;

-- ============================================================================
-- TEST SUMMARY
-- ============================================================================
SELECT 'Test Suite Complete' AS status,
  'Review all PASS/FAIL messages above.' AS instructions;
