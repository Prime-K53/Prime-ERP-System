-- ============================================================================
-- Fix RLS company_id mismatch between frontend and database
-- 
-- Problem: get_user_company_id() reads from profiles.company_id but
-- some profiles have NULL company_id because:
--   a) Profile was created before the company_id column existed
--   b) The profile upsert code deletes company_id from the data JSONB
--      before storing (cloudDb.ts lines 330-331)
--
-- With company_id = NULL, the RLS check
--   company_id = get_user_company_id()
-- evaluates to NULL (never TRUE), causing ALL writes to fail with 403:
--   "new row violates row-level security policy for table"
--
-- Fix:
--   1. Backfill profiles.company_id from companies table or profile data
--   2. Update get_user_company_id() with more fallbacks
--   3. Add trigger to auto-set company_id on profile insert/update
-- ============================================================================

-- ============================================================================
-- 0. First, identify and report the current state
-- ============================================================================
SELECT '=== DIAGNOSTIC START ===' as step;

SELECT 'Companies available:' as info, id, company_name
FROM public.companies
ORDER BY created_at;

SELECT 'Profiles with NULL company_id:' as info, p.id, p.user_id,
  p.data ->> 'company_id' as data_company_id,
  p.data ->> 'companyId' as data_companyId,
  p.data ->> 'role' as role
FROM public.profiles p
WHERE p.company_id IS NULL OR p.company_id = '';

-- ============================================================================
-- 1. Backfill profiles.company_id
--    Strategy: for each profile missing company_id, try:
--    a. The auth.users raw_user_meta_data
--    b. The profile's own data JSONB (various possible key names)
--    c. The companies table (first company sorted by created_at)
--    d. If multiple companies exist, we'll assign the first one and warn
-- ============================================================================
DO $$
DECLARE
  v_company_id TEXT;
  v_company_count INT;
  v_updated INT;
BEGIN
  -- Count companies
  SELECT COUNT(*) INTO v_company_count FROM public.companies;

  -- Get the first company (prefer the one with the earliest admin profile association)
  SELECT id INTO v_company_id FROM public.companies ORDER BY created_at ASC LIMIT 1;

  RAISE NOTICE 'Found % companies, using default company_id: %', v_company_count, v_company_id;

  -- Update profiles that are missing company_id
  UPDATE public.profiles p
  SET company_id = COALESCE(
    p.company_id,
    (SELECT u.raw_user_meta_data ->> 'company_id' FROM auth.users u WHERE u.id = p.user_id::uuid),
    p.data ->> 'company_id',
    p.data ->> 'companyId',
    p.data ->> 'companyid',
    p.data ->> 'company',
    (SELECT id FROM public.companies ORDER BY created_at ASC LIMIT 1)
  )
  WHERE p.company_id IS NULL OR p.company_id = '';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'Backfilled % profiles with company_id', v_updated;

  IF v_company_count > 1 AND v_updated > 0 THEN
    RAISE WARNING 'Multiple companies exist. Profiles were assigned to the first company (%). '
                  'If a profile belongs to a different company, update it manually: '
                  'UPDATE public.profiles SET company_id = ''<correct-id>'' WHERE user_id = ''<user-id>'';',
                  v_company_id;
  END IF;
END $$;

-- ============================================================================
-- 2. Update the helper function with fallbacks
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()::text LIMIT 1),
    auth.jwt() ->> 'company_id',
    (SELECT raw_user_meta_data ->> 'company_id' FROM auth.users WHERE id = auth.uid())
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_user_company_id() TO authenticated;

-- ============================================================================
-- 3. Trigger: auto-set company_id on profile INSERT or UPDATE when omitted
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
      (SELECT raw_user_meta_data ->> 'company_id' FROM auth.users WHERE id = NEW.user_id::uuid),
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
-- 4. Verify the fix
-- ============================================================================
SELECT '=== VERIFICATION ===' as step;

SELECT 'Profiles still missing company_id:' as check_name, COUNT(*) as count
FROM public.profiles
WHERE company_id IS NULL OR company_id = '';

SELECT 'Profiles with their company_id:' as info, id, user_id, company_id
FROM public.profiles
ORDER BY created_at;

-- Run this AFTER the backfill and function update to test
SELECT 'get_user_company_id() returns:' as check_name, public.get_user_company_id() as value;
