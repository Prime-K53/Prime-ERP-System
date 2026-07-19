-- ============================================================================
-- FIX: Supabase 403 Forbidden on accounts table
--
-- Run this ENTIRE script in your Supabase SQL Editor
-- (SQL Editor → New Query → Paste → Run)
-- ============================================================================

-- ============================================================================
-- STEP 1: Fix get_user_company_id() with NULLIF guards for empty strings
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
    NULLIF((SELECT raw_user_meta_data ->> 'company_id' FROM auth.users WHERE id = auth.uid()), '')
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_user_company_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_company_id() TO anon;

-- ============================================================================
-- STEP 2: Create profiles for auth users who are missing them
-- ============================================================================
DO $$
DECLARE
  v_target_company_id text;
  v_user RECORD;
  v_created int := 0;
BEGIN
  SELECT id INTO v_target_company_id FROM public.companies ORDER BY created_at ASC LIMIT 1;

  IF v_target_company_id IS NULL THEN
    RAISE EXCEPTION 'No companies exist. Create a company first.';
  END IF;

  FOR v_user IN
    SELECT u.id, u.email, u.raw_user_meta_data
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.user_id = u.id::text
    WHERE p.id IS NULL
  LOOP
    INSERT INTO public.profiles (
      id, user_id, company_id, full_name, role, status, data, created_at, updated_at
    ) VALUES (
      'PROF-' || gen_random_uuid()::text,
      v_user.id::text,
      v_target_company_id,
      COALESCE(
        v_user.raw_user_meta_data ->> 'full_name',
        v_user.raw_user_meta_data ->> 'name',
        v_user.email,
        'User'
      ),
      COALESCE(v_user.raw_user_meta_data ->> 'role', 'Admin'),
      'Active',
      '{}'::jsonb,
      NOW(),
      NOW()
    );
    v_created := v_created + 1;
  END LOOP;
  RAISE NOTICE 'Created % profiles', v_created;
END $$;

-- ============================================================================
-- STEP 3: Auto-create profile on new user signup
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id text;
BEGIN
  v_company_id := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'company_id', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'companyId', ''),
    (SELECT id FROM public.companies ORDER BY created_at ASC LIMIT 1)
  );

  INSERT INTO public.profiles (
    id, user_id, company_id, full_name, role, status, data, created_at, updated_at
  ) VALUES (
    'PROF-' || gen_random_uuid()::text,
    NEW.id::text,
    v_company_id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      NEW.email,
      'User'
    ),
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'Member'),
    'Active',
    '{}'::jsonb,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_signup();

-- ============================================================================
-- STEP 4: Backfill profiles missing company_id
-- ============================================================================
DO $$
DECLARE
  v_updated int;
  v_default_company_id text;
BEGIN
  SELECT id INTO v_default_company_id FROM public.companies ORDER BY created_at ASC LIMIT 1;

  UPDATE public.profiles p
  SET company_id = COALESCE(
    NULLIF(p.company_id, ''),
    NULLIF(p.data ->> 'company_id', ''),
    NULLIF(p.data ->> 'companyId', ''),
    (SELECT u.raw_user_meta_data ->> 'company_id' FROM auth.users u WHERE u.id = p.user_id::uuid),
    v_default_company_id
  ),
  updated_at = NOW()
  WHERE p.company_id IS NULL OR p.company_id = '';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'Backfilled % profiles', v_updated;
END $$;

-- ============================================================================
-- STEP 5: Ensure RLS is enabled on accounts table
-- ============================================================================
ALTER TABLE IF EXISTS public.accounts ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 6: Add tenant_all policy to accounts table
-- ============================================================================
DROP POLICY IF EXISTS "tenant_all" ON public.accounts;
CREATE POLICY "tenant_all" ON public.accounts
FOR ALL
USING (company_id = public.get_user_company_id())
WITH CHECK (company_id = public.get_user_company_id());

-- ============================================================================
-- STEP 7: Auto-set company_id on profile insert/update
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
-- VERIFICATION
-- ============================================================================
SELECT '=== VERIFICATION ===' as step;

SELECT 'Profiles missing company_id:' as check, COUNT(*) FROM public.profiles WHERE company_id IS NULL OR company_id = '';

SELECT 'Auth users without profiles:' as check, COUNT(*)
FROM auth.users u LEFT JOIN public.profiles p ON p.user_id = u.id::text WHERE p.id IS NULL;

SELECT 'Policies on accounts:' as check, policyname, permissive, cmd
FROM pg_policies WHERE tablename = 'accounts' AND schemaname = 'public';

SELECT 'get_user_company_id() test:' as check, public.get_user_company_id() as value;
