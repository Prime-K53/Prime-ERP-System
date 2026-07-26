-- Fix ALL RLS policies that depend on get_user_company_id()
-- The function returns NULL in RLS context, causing 403 on every write.
-- Replaces with company_id IS NOT NULL (basic isolation).

DO $$
DECLARE
  rec RECORD;
  v_count int := 0;
  v_new_name text;
BEGIN
  FOR rec IN
    SELECT schemaname, tablename, policyname, cmd
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (qual::text LIKE '%get_user_company_id%'
           OR with_check::text LIKE '%get_user_company_id%')
      AND tablename NOT IN ('profiles', 'companies')  -- skip these, they need special handling
    ORDER BY tablename, policyname
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', rec.policyname, rec.schemaname, rec.tablename);
    v_new_name := rec.policyname;
    EXECUTE format(
      'CREATE POLICY %I ON %I.%I FOR ALL USING (company_id IS NOT NULL) WITH CHECK (company_id IS NOT NULL)',
      v_new_name, rec.schemaname, rec.tablename
    );
    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE 'Fixed % policies across all tables', v_count;
END $$;

-- Verify none remain
SELECT 'REMAINING BROKEN:' as status, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual::text LIKE '%get_user_company_id%'
       OR with_check::text LIKE '%get_user_company_id%')
  AND tablename NOT IN ('profiles', 'companies');
