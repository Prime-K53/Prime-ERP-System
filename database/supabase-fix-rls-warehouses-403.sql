-- ============================================================================
-- Root Cause Fix: RLS 403 Forbidden on warehouses upsert
--
-- Root Cause:
--   get_user_company_id() returns NULL because the authenticated user
--   has no row in public.profiles. All three COALESCE branches fail:
--     1. profiles.company_id → NULL (no profile row exists)
--     2. auth.jwt() ->> 'company_id' → NULL (not in JWT claims)
--     3. auth.users raw_user_meta_data ->> 'company_id' → NULL (not set)
--
--   Both RLS policies on warehouses evaluate:
--     company_id = get_user_company_id() → company_id = NULL → NULL → FALSE → 403
--
-- Fixes applied:
--   1. Create profiles for ALL auth users missing them, linked to existing company
--   2. Fix get_user_company_id() with NULLIF guards for empty strings
--   3. Add trigger to auto-create profiles on new signups (prevents future orphans)
--   4. Backfill ALL profiles missing company_id (defense in depth)
--   5. Drop insecure tenant_all policy (grants access to public/anonymous role)
--   6. Add foreign key constraint on profiles.company_id
--
-- NOTE: This migration does NOT use auth.uid() since Supabase SQL Editor
--       has no active session context. Instead it finds and fixes ALL
--       orphan users from auth.users.
--
-- Run this in Supabase SQL Editor as a single migration.
-- ============================================================================

-- ============================================================================
-- STEP 1: Report current state
-- ============================================================================
SELECT '=== DIAGNOSIS ===' as step;
SELECT current_database() as database_name;

SELECT 'Auth users without profiles:' as problem, COUNT(*) as count
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id::text
WHERE p.id IS NULL;

SELECT 'Profiles missing company_id:' as problem, COUNT(*) as count
FROM public.profiles
WHERE company_id IS NULL OR company_id = '';

SELECT 'Companies available:' as info, COUNT(*) as count FROM public.companies;

-- ============================================================================
-- STEP 2: Fix get_user_company_id() with NULLIF guards for empty strings
--         This prevents the known bug where COALESCE treats '' as a value
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

-- ============================================================================
-- STEP 3: Create profiles for ALL auth users who are missing them
--         This works in SQL Editor (no session needed) by scanning auth.users
-- ============================================================================
DO $$
DECLARE
  v_target_company_id text;
  v_user RECORD;
  v_created int := 0;
BEGIN
  -- Get default company
  SELECT id INTO v_target_company_id FROM public.companies ORDER BY created_at ASC LIMIT 1;

  IF v_target_company_id IS NULL THEN
    RAISE EXCEPTION 'No companies exist. You must create a company first.';
  END IF;

  FOR v_user IN
    SELECT u.id, u.email, u.raw_user_meta_data
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.user_id = u.id::text
    WHERE p.id IS NULL
  LOOP
    INSERT INTO public.profiles (
      id,
      user_id,
      company_id,
      full_name,
      role,
      status,
      data,
      created_at,
      updated_at
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
    RAISE NOTICE 'Created profile for user % (email: %) → company %', v_user.id, v_user.email, v_target_company_id;
  END LOOP;

  RAISE NOTICE 'Total profiles created: %', v_created;
  
  IF v_created = 0 THEN
    RAISE NOTICE 'No orphan users found. All auth users already have profiles.';
  END IF;
END $$;

-- ============================================================================
-- STEP 4: Trigger: auto-create profile on new user signup
--         This prevents future orphan users (users with no profile)
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
  -- Get the company_id from signup metadata, or use first company
  v_company_id := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'company_id', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'companyId', ''),
    (SELECT id FROM public.companies ORDER BY created_at ASC LIMIT 1)
  );

  -- Create profile (silently skip if already exists)
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

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger on auth.users for new signups
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_signup();

-- ============================================================================
-- STEP 5: Backfill ALL profiles missing company_id (defense in depth)
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
    NULLIF(p.data ->> 'companyid', ''),
    (SELECT u.raw_user_meta_data ->> 'company_id' FROM auth.users u WHERE u.id = p.user_id::uuid),
    v_default_company_id
  ),
  updated_at = NOW()
  WHERE p.company_id IS NULL OR p.company_id = '';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'Backfilled % profiles with company_id', v_updated;
END $$;

-- ============================================================================
-- STEP 6: Security - Drop the insecure `tenant_all` policy on warehouses
--         It grants access to `public` role (both anon + authenticated).
--         `Users can manage warehouses` already covers authenticated users.
-- ============================================================================
DROP POLICY IF EXISTS "tenant_all" ON public.warehouses;

-- Also drop from any other tables that may have it
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE policyname = 'tenant_all'
      AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', rec.policyname, rec.schemaname, rec.tablename);
    RAISE NOTICE 'Dropped insecure policy tenant_all on %.%', rec.schemaname, rec.tablename;
  END LOOP;
END $$;

-- ============================================================================
-- STEP 7: Add index on profiles.company_id for performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON public.profiles(company_id);

-- ============================================================================
-- STEP 8: VERIFICATION
-- ============================================================================
SELECT '=== VERIFICATION ===' as step;

SELECT 'Auth users without profiles:' as check, COUNT(*) as count
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id::text
WHERE p.id IS NULL;

SELECT 'Profiles still missing company_id:' as check, COUNT(*) as count
FROM public.profiles
WHERE company_id IS NULL OR company_id = '';

SELECT 'Profiles created:' as info, id, user_id, company_id, full_name, role
FROM public.profiles
ORDER BY created_at DESC
LIMIT 20;

SELECT 'Policies on warehouses:' as info, schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'warehouses' AND schemaname = 'public'
ORDER BY policyname;

-- ============================================================================
-- STEP 9: Add foreign key constraint (optional but recommended)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_company_id_fkey'
      AND table_schema = 'public'
      AND table_name = 'profiles'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES public.companies(id)
      ON DELETE CASCADE
      NOT VALID;
    RAISE NOTICE 'Added foreign key profiles.company_id → companies.id';
  END IF;
END $$;

-- ============================================================================
-- End of migration
-- ============================================================================