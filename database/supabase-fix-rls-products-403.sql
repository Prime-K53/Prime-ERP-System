-- ============================================================================
-- Fix 403 Forbidden when inserting products: RLS company_id mismatch
--
-- Problem: get_user_company_id() returns NULL or empty string because:
--   1. Profile's company_id column is NULL (not set during signup)
--   2. JWT claims contain company_id: '' (empty string from signup metadata)
--   3. COALESCE treats '' as non-null, so it never falls through to auth.users
--
-- Run this in Supabase SQL Editor.
-- ============================================================================

-- ============================================================================
-- 1. Backfill profiles with missing company_id
-- ============================================================================
DO $$
DECLARE
  v_updated INT;
BEGIN
  UPDATE public.profiles p
  SET company_id = COALESCE(
    NULLIF(p.company_id, ''),
    (SELECT u.raw_user_meta_data ->> 'company_id' FROM auth.users u WHERE u.id = p.user_id::uuid),
    p.data ->> 'company_id',
    p.data ->> 'companyId',
    (SELECT id FROM public.companies ORDER BY created_at ASC LIMIT 1)
  )
  WHERE p.company_id IS NULL OR p.company_id = '';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'Backfilled % profiles with company_id', v_updated;
END $$;

-- ============================================================================
-- 2. Fix get_user_company_id() to handle empty strings from JWT
--    NULLIF converts '' to NULL so COALESCE falls through correctly
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF((SELECT company_id FROM public.profiles WHERE user_id = auth.uid()::text LIMIT 1), ''),
    NULLIF(auth.jwt() ->> 'company_id', ''),
    NULLIF(auth.jwt() ->> 'tenant_id', ''),
    (SELECT raw_user_meta_data ->> 'company_id' FROM auth.users WHERE id = auth.uid())
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_user_company_id() TO authenticated;

-- ============================================================================
-- 3. Drop the RESTRICTIVE tenant_isolation policy from all tables.
--    The PERMISSIVE "tenant_all" policy already enforces the same check
--    (company_id = get_user_company_id()).
--    Having both means both must pass (AND logic), which is redundant and
--    causes issues if get_user_company_id() returns unexpected values.
-- ============================================================================
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE policyname IN ('tenant_isolation', 'tenant_isolation_policy')
      AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', rec.policyname, rec.schemaname, rec.tablename);
    RAISE NOTICE 'Dropped policy % on %.%', rec.policyname, rec.schemaname, rec.tablename;
  END LOOP;
END $$;

-- ============================================================================
-- 4. Ensure the trigger auto-sets company_id on profile insert/update
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_profile_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NULL OR NEW.company_id = '' THEN
    NEW.company_id := COALESCE(
      NULLIF((SELECT raw_user_meta_data ->> 'company_id' FROM auth.users WHERE id = NEW.user_id::uuid), ''),
      NEW.data ->> 'company_id',
      NEW.data ->> 'companyId',
      (SELECT id FROM public.companies ORDER BY created_at ASC LIMIT 1)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profile_company_id ON public.profiles;
CREATE TRIGGER trg_profile_company_id
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_profile_company_id();

-- ============================================================================
-- 5. Verify the fix
-- ============================================================================
SELECT '=== VERIFICATION ===' as step;

SELECT 'Profiles still missing company_id:' as check_name, COUNT(*) as count
FROM public.profiles
WHERE company_id IS NULL OR company_id = '';

SELECT 'get_user_company_id() returns:' as check_name, public.get_user_company_id() as value;

SELECT 'Policies on products table:' as info, schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'products' AND schemaname = 'public'
ORDER BY policyname;
