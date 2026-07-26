-- ============================================================================
-- ROW LEVEL SECURITY: Multi-Tenant Isolation
-- ============================================================================
-- This migration replaces all existing RLS policies with a hardened set.
-- Every policy uses the `company_users` table for membership verification.
-- ============================================================================

-- ============================================================================
-- PART 1: Helper Functions (Idempotent)
-- ============================================================================

-- Enhanced company_id resolver with better fallback chain
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    -- 1. Company from company_users table (primary source)
    NULLIF((
      SELECT cu.company_id FROM public.company_users cu
      WHERE cu.user_id = auth.uid() AND cu.is_default = true
      LIMIT 1
    ), ''),
    -- 2. Any company from company_users
    NULLIF((
      SELECT cu.company_id FROM public.company_users cu
      WHERE cu.user_id = auth.uid()
      LIMIT 1
    ), ''),
    -- 3. Fallback to profiles (legacy)
    NULLIF((
      SELECT p.company_id FROM public.profiles p
      WHERE p.user_id = auth.uid()::text
      LIMIT 1
    ), ''),
    -- 4. JWT claims
    NULLIF(auth.jwt() ->> 'company_id', ''),
    NULLIF(auth.jwt() ->> 'tenant_id', ''),
    -- 5. User metadata
    NULLIF((SELECT raw_user_meta_data ->> 'company_id' FROM auth.users WHERE id = auth.uid()), '')
  );
$$;

-- Check if a user belongs to a specific company
CREATE OR REPLACE FUNCTION public.user_belongs_to_company(check_company_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.user_id = auth.uid() AND cu.company_id = check_company_id
    UNION
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()::text AND p.company_id = check_company_id
  );
$$;

-- Get all companies for the current user
CREATE OR REPLACE FUNCTION public.get_user_companies()
RETURNS SETOF TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cu.company_id FROM public.company_users cu WHERE cu.user_id = auth.uid()
  UNION
  SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid()::text AND p.company_id IS NOT NULL AND p.company_id <> '';
$$;

-- ============================================================================
-- PART 2: Drop ALL Existing Policies (Clean Slate)
-- ============================================================================

DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN (
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I;', rec.policyname, rec.schemaname, rec.tablename);
  END LOOP;
END $$;

-- ============================================================================
-- PART 3: Core Tables
-- ============================================================================

-- companies table: users can see companies they belong to
DROP POLICY IF EXISTS companies_select ON public.companies;
CREATE POLICY companies_select ON public.companies
  FOR SELECT TO authenticated
  USING (
    id = public.get_user_company_id()
    OR auth.role() = 'service_role'
    OR EXISTS (SELECT 1 FROM public.company_users cu WHERE cu.company_id = companies.id AND cu.user_id = auth.uid())
  );

DROP POLICY IF EXISTS companies_insert ON public.companies;
CREATE POLICY companies_insert ON public.companies
  FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'service_role' OR auth.jwt() ->> 'role' = 'admin');

DROP POLICY IF EXISTS companies_update ON public.companies;
CREATE POLICY companies_update ON public.companies
  FOR UPDATE TO authenticated
  USING (id = public.get_user_company_id())
  WITH CHECK (id = public.get_user_company_id());

DROP POLICY IF EXISTS companies_delete ON public.companies;
CREATE POLICY companies_delete ON public.companies
  FOR DELETE TO authenticated
  USING (id = public.get_user_company_id() AND auth.jwt() ->> 'role' = 'admin');

-- company_users table: users see their own memberships
DROP POLICY IF EXISTS company_users_select ON public.company_users;
CREATE POLICY company_users_select ON public.company_users
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR company_id = public.get_user_company_id()
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS company_users_insert ON public.company_users;
CREATE POLICY company_users_insert ON public.company_users
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR (company_id = public.get_user_company_id() AND auth.jwt() ->> 'role' IN ('owner', 'admin'))
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS company_users_update ON public.company_users;
CREATE POLICY company_users_update ON public.company_users
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR company_id = public.get_user_company_id())
  WITH CHECK (user_id = auth.uid() OR company_id = public.get_user_company_id());

-- profiles table: backward compatibility
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()::text
    OR company_id = public.get_user_company_id()
    OR EXISTS (SELECT 1 FROM public.company_users cu WHERE cu.company_id = profiles.company_id AND cu.user_id = auth.uid())
  );

DROP POLICY IF EXISTS profiles_insert ON public.profiles;
CREATE POLICY profiles_insert ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS profiles_update ON public.profiles;
CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS profiles_delete ON public.profiles;
CREATE POLICY profiles_delete ON public.profiles
  FOR DELETE TO authenticated
  USING (user_id = auth.uid()::text);

-- ============================================================================
-- PART 4: Generic Tenant Isolation Policy
-- ============================================================================
-- Applies to ALL tenant tables with company_id column.
-- Uses RESTRICTIVE policy to ensure no other policy can bypass tenant isolation.

CREATE OR REPLACE FUNCTION public.create_tenant_policy()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT t.tablename::text FROM pg_tables t
    WHERE t.schemaname = 'public'
      AND EXISTS (
        SELECT 1 FROM information_schema.columns c
        WHERE c.table_schema = 'public' AND c.table_name = t.tablename
          AND c.column_name = 'company_id'
      )
      AND t.tablename NOT IN ('companies', 'profiles', 'company_users', 'idempotency_keys')
  LOOP
    -- Drop existing policies on this table
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_all ON %I;', tbl);

    -- Create RESTRICTIVE policy that enforces tenant isolation
    -- RESTRICTIVE means this policy is AND-ed with any other policies
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I AS RESTRICTIVE FOR ALL TO authenticated
       USING (company_id = public.get_user_company_id())
       WITH CHECK (company_id = public.get_user_company_id())',
      tbl
    );

    -- Create PERMISSIVE policy for service_role (bypass)
    EXECUTE format(
      'CREATE POLICY tenant_service ON %I AS PERMISSIVE FOR ALL TO authenticated
       USING (auth.role() = ''service_role'')
       WITH CHECK (auth.role() = ''service_role'')',
      tbl
    );
  END LOOP;
END;
$$;

SELECT public.create_tenant_policy();

-- ============================================================================
-- PART 5: Row-Level Security Verification
-- ============================================================================

-- Verify all tenant tables have at least one policy
DO $$
DECLARE
  tbl TEXT;
  missing TEXT[] := '{}';
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
    missing := array_append(missing, tbl);
  END LOOP;

  IF array_length(missing, 1) > 0 THEN
    RAISE WARNING 'Tables missing RLS policies: %', array_to_string(missing, ', ');
    RAISE WARNING 'Run: SELECT public.create_tenant_policy(); to fix.';
  ELSE
    RAISE NOTICE 'All tenant tables have RLS policies.';
  END IF;
END $$;
