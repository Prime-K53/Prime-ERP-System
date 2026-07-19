CREATE OR REPLACE FUNCTION public.test_auth_uid()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid()::text;
$$;

GRANT EXECUTE ON FUNCTION public.test_auth_uid() TO authenticated;
