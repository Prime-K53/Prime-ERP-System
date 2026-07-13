-- ============================================================================
-- Fix: Add missing RLS policies for tables that have RLS enabled but no policies
--
-- Problem: Several tables have RLS enabled (ALTER TABLE ... ENABLE ROW LEVEL SECURITY)
-- but have NO policies defined. When RLS is enabled with zero policies,
-- ALL operations are denied (SELECT, INSERT, UPDATE, DELETE all return 403).
--
-- Root cause: The migration scripts created policies for most tables via DO blocks
-- that iterate over table lists, but some tables were missed or the DO block
-- failed silently (e.g., table didn't exist at migration time).
--
-- This migration:
--   1. Finds ALL tables in public schema with RLS enabled
--   2. Checks if they have at least one PERMISSIVE policy
--   3. Creates a "tenant_all" policy for any table missing one
--   4. Drops any orphaned RESTRICTIVE policies without matching PERMISSIVE ones
-- ============================================================================

-- ============================================================================
-- STEP 1: Report current state
-- ============================================================================
SELECT '=== DIAGNOSIS: Tables with RLS enabled but NO policies ===' as step;

SELECT c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       COUNT(p.policyname) AS policy_count
FROM pg_class c
LEFT JOIN pg_policies p ON p.tablename = c.relname AND p.schemaname = 'public'
WHERE c.relnamespace = 'public'::regnamespace
  AND c.relkind = 'r'  -- ordinary tables
  AND c.relrowsecurity = true
GROUP BY c.relname, c.relrowsecurity
HAVING COUNT(p.policyname) = 0
ORDER BY c.relname;

-- ============================================================================
-- STEP 2: Find and fix ALL tables with RLS enabled but no policies
-- ============================================================================
DO $$
DECLARE
  rec RECORD;
  v_fixed int := 0;
BEGIN
  FOR rec IN
    SELECT c.relname AS table_name
    FROM pg_class c
    LEFT JOIN pg_policies p ON p.tablename = c.relname AND p.schemaname = 'public'
    WHERE c.relnamespace = 'public'::regnamespace
      AND c.relkind = 'r'
      AND c.relrowsecurity = true
    GROUP BY c.relname
    HAVING COUNT(p.policyname) = 0
  LOOP
    BEGIN
      EXECUTE format(
        'CREATE POLICY "tenant_all" ON %I AS PERMISSIVE FOR ALL '
        'USING (company_id = public.get_user_company_id()) '
        'WITH CHECK (company_id = public.get_user_company_id())',
        rec.table_name
      );
      RAISE NOTICE 'Created tenant_all policy on %', rec.table_name;
      v_fixed := v_fixed + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not create policy on %: %', rec.table_name, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'Total tables fixed: %', v_fixed;
  
  IF v_fixed = 0 THEN
    RAISE NOTICE 'All tables with RLS enabled already have policies. Nothing to fix.';
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Drop orphaned RESTRICTIVE policies that have no matching PERMISSIVE
--         A RESTRICTIVE policy ANDs with PERMISSIVE policies. If only a
--         RESTRICTIVE policy exists, it blocks everything.
-- ============================================================================
DO $$
DECLARE
  rec RECORD;
  v_dropped int := 0;
BEGIN
  FOR rec IN
    SELECT p.schemaname, p.tablename, p.policyname
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.permissive = 'RESTRICTIVE'
      AND NOT EXISTS (
        SELECT 1 FROM pg_policies p2
        WHERE p2.schemaname = p.schemaname
          AND p2.tablename = p.tablename
          AND p2.permissive = 'PERMISSIVE'
      )
  LOOP
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', rec.policyname, rec.schemaname, rec.tablename);
      RAISE NOTICE 'Dropped orphaned RESTRICTIVE policy % on %.%', rec.policyname, rec.schemaname, rec.tablename;
      v_dropped := v_dropped + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not drop policy % on %.%: %', rec.policyname, rec.schemaname, rec.tablename, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'Total orphaned RESTRICTIVE policies dropped: %', v_dropped;
END $$;

-- ============================================================================
-- STEP 4: VERIFICATION
-- ============================================================================
SELECT '=== VERIFICATION ===' as step;

SELECT 'Tables with RLS enabled but NO policies (should be 0):' as check,
       COUNT(*) as count
FROM (
  SELECT c.relname AS table_name
  FROM pg_class c
  LEFT JOIN pg_policies p ON p.tablename = c.relname AND p.schemaname = 'public'
  WHERE c.relnamespace = 'public'::regnamespace
    AND c.relkind = 'r'
    AND c.relrowsecurity = true
  GROUP BY c.relname
  HAVING COUNT(p.policyname) = 0
) missing;

SELECT 'Tables with orphaned RESTRICTIVE policies (should be 0):' as check,
       COUNT(*) as count
FROM pg_policies p
WHERE p.schemaname = 'public'
  AND p.permissive = 'RESTRICTIVE'
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p2
    WHERE p2.schemaname = p.schemaname
      AND p2.tablename = p.tablename
      AND p2.permissive = 'PERMISSIVE'
  );

SELECT 'All tables with RLS and their policy count:' as info,
       c.relname,
       COUNT(p.policyname) as policies
FROM pg_class c
LEFT JOIN pg_policies p ON p.tablename = c.relname AND p.schemaname = 'public'
WHERE c.relnamespace = 'public'::regnamespace
  AND c.relkind = 'r'
  AND c.relrowsecurity = true
GROUP BY c.relname
ORDER BY c.relname;

-- ============================================================================
-- End of migration
-- ============================================================================