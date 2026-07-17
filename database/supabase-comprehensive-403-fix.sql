-- ============================================================================
-- COMPREHENSIVE FIX: Supabase 403 Forbidden on ALL tables
-- 
-- Root Cause Analysis:
--   1. Users authenticated via Supabase Auth but have NO row in public.profiles
--   2. get_user_company_id() returns NULL → RLS policies reject ALL operations
--   3. Some tables have RLS enabled but lack any PERMISSIVE policies
--   4. Empty string '' is treated as a valid value by COALESCE instead of NULL
--
-- Fixes:
--   1. Fix get_user_company_id() with NULLIF guards for empty strings
--   2. Create profiles for ALL auth users missing them, linked to an existing company
--   3. Create auto-profile trigger on new signups
--   4. Backfill ALL profiles missing company_id
--   5. Add tenant_all policies to ANY table missing them
--   6. Fix products.id column type from SERIAL to TEXT
--   7. Drop insecure/circular policies
--
-- Run this ENTIRE script in your Supabase SQL Editor (SQL Editor → New Query → Paste → Run)
-- ============================================================================

-- ============================================================================
-- STEP 1: Report current state
-- ============================================================================
SELECT '=== DIAGNOSIS ===' as step;

SELECT 'Auth users without profiles:' as problem, COUNT(*) as count
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id::text
WHERE p.id IS NULL;

SELECT 'Profiles missing company_id:' as problem, COUNT(*) as count
FROM public.profiles
WHERE company_id IS NULL OR company_id = '';

SELECT 'Companies available:' as info, COUNT(*) as count FROM public.companies;

SELECT 'Tables with RLS enabled but NO policies:' as problem, c.relname AS table_name
FROM pg_class c
LEFT JOIN pg_policies p ON p.tablename = c.relname AND p.schemaname = 'public'
WHERE c.relnamespace = 'public'::regnamespace
  AND c.relkind = 'r'
  AND c.relrowsecurity = true
GROUP BY c.relname
HAVING COUNT(p.policyname) = 0
ORDER BY c.relname;

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
GRANT EXECUTE ON FUNCTION public.get_user_company_id() TO anon;

-- ============================================================================
-- STEP 3: Create profiles for ALL auth users who are missing them
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
--         Prevents future orphan users (users with no profile)
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
-- STEP 6: Add tenant_all policy to ALL tables that have RLS enabled,
--         have NO permissive policies, AND have a company_id column.
--         This fixes 403 on tables like customers, settings, products, etc.
-- ============================================================================
DO $$
DECLARE
  rec RECORD;
  v_fixed int := 0;
BEGIN
  FOR rec IN
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN information_schema.columns col
      ON col.table_schema = 'public'
      AND col.table_name = c.relname
      AND col.column_name = 'company_id'
    WHERE c.relnamespace = 'public'::regnamespace
      AND c.relkind = 'r'
      AND c.relrowsecurity = true
      AND NOT EXISTS (
        SELECT 1 FROM pg_policies p
        WHERE p.tablename = c.relname
          AND p.schemaname = 'public'
          AND p.permissive = 'PERMISSIVE'
      )
  LOOP
    EXECUTE format(
      'CREATE POLICY tenant_all ON %I
       FOR ALL
       USING (company_id = public.get_user_company_id())
       WITH CHECK (company_id = public.get_user_company_id())',
      rec.table_name
    );
    v_fixed := v_fixed + 1;
    RAISE NOTICE 'Added tenant_all policy to %.%', 'public', rec.table_name;
  END LOOP;

  RAISE NOTICE 'Total policies added: %', v_fixed;
END $$;

-- ============================================================================
-- STEP 7: Fix products.id column type (SERIAL → TEXT)
--         The app generates string IDs like "RM-PAP-A4" but the column is SERIAL
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products'
    AND column_name = 'id' AND data_type = 'integer'
  ) THEN
    ALTER TABLE public.products ALTER COLUMN id DROP DEFAULT;
    ALTER TABLE public.products ALTER COLUMN id TYPE TEXT USING id::TEXT;
    DROP SEQUENCE IF EXISTS public.products_id_seq;
    RAISE NOTICE 'Fixed products.id type from SERIAL to TEXT';
  ELSE
    RAISE NOTICE 'products.id is already TEXT - no change needed';
  END IF;
END $$;

-- ============================================================================
-- STEP 8: Drop insecure/circular policies that cause 403 conflicts
-- ============================================================================
DROP POLICY IF EXISTS "tenant_all" ON public.warehouses;

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
    RAISE NOTICE 'Dropped conflicting policy % on %.%', rec.policyname, rec.schemaname, rec.tablename;
  END LOOP;
END $$;

-- ============================================================================
-- STEP 9: Ensure trigger auto-sets company_id on profile insert/update
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
-- STEP 10: Add index on profiles.company_id for performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON public.profiles(company_id);

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT '=== VERIFICATION ===' as step;

SELECT 'Profiles still missing company_id:' as check_name, COUNT(*) as count
FROM public.profiles
WHERE company_id IS NULL OR company_id = '';

SELECT 'Auth users still without profiles:' as check_name, COUNT(*) as count
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id::text
WHERE p.id IS NULL;

SELECT 'Tables still with RLS enabled but NO policies:' as check_name, c.relname AS table_name
FROM pg_class c
LEFT JOIN pg_policies p ON p.tablename = c.relname AND p.schemaname = 'public'
WHERE c.relnamespace = 'public'::regnamespace
  AND c.relkind = 'r'
  AND c.relrowsecurity = true
GROUP BY c.relname
HAVING COUNT(p.policyname) = 0
ORDER BY c.relname;

SELECT 'get_user_company_id() test:' as check_name, public.get_user_company_id() as value;

SELECT 'Profiles created:' as info, id, user_id, company_id, full_name, role
FROM public.profiles
ORDER BY created_at DESC
LIMIT 20;

SELECT 'Policies on warehouses:' as info, schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'warehouses' AND schemaname = 'public'
ORDER BY policyname;

SELECT 'Policies on products:' as info, schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'products' AND schemaname = 'public'
ORDER BY policyname;

SELECT 'Policies on settings:' as info, schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'settings' AND schemaname = 'public'
ORDER BY policyname;

SELECT 'Policies on customers:' as info, schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'customers' AND schemaname = 'public'
ORDER BY policyname;

SELECT 'ALL policies in public schema:' as info, schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
