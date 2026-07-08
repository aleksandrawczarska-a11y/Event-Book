-- EventBook domain RLS (F-01: domain-schema-foundation, phase 2)

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

CREATE OR REPLACE FUNCTION public.current_decorator_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.decorator_profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.current_decorator_profile_id() TO authenticated;

ALTER TABLE public.decorator_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_inquiries ENABLE ROW LEVEL SECURITY;

-- decorator_profiles

CREATE POLICY decorator_profiles_select_own
  ON public.decorator_profiles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY decorator_profiles_insert_own
  ON public.decorator_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY decorator_profiles_update_own
  ON public.decorator_profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY decorator_profiles_select_published
  ON public.decorator_profiles
  FOR SELECT
  TO anon, authenticated
  USING (is_published = true);

CREATE POLICY decorator_profiles_admin_select
  ON public.decorator_profiles
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY decorator_profiles_admin_update
  ON public.decorator_profiles
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- portfolio_entries

CREATE POLICY portfolio_entries_select_own
  ON public.portfolio_entries
  FOR SELECT
  TO authenticated
  USING (decorator_profile_id = public.current_decorator_profile_id());

CREATE POLICY portfolio_entries_insert_own
  ON public.portfolio_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (decorator_profile_id = public.current_decorator_profile_id());

CREATE POLICY portfolio_entries_update_own
  ON public.portfolio_entries
  FOR UPDATE
  TO authenticated
  USING (decorator_profile_id = public.current_decorator_profile_id())
  WITH CHECK (decorator_profile_id = public.current_decorator_profile_id());

CREATE POLICY portfolio_entries_delete_own
  ON public.portfolio_entries
  FOR DELETE
  TO authenticated
  USING (decorator_profile_id = public.current_decorator_profile_id());

CREATE POLICY portfolio_entries_select_public_approved
  ON public.portfolio_entries
  FOR SELECT
  TO anon, authenticated
  USING (
    moderation_status = 'approved'
    AND EXISTS (
      SELECT 1
      FROM public.decorator_profiles dp
      WHERE dp.id = portfolio_entries.decorator_profile_id
        AND dp.is_published = true
    )
  );

CREATE POLICY portfolio_entries_admin_update_moderation
  ON public.portfolio_entries
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- contact_inquiries

CREATE POLICY contact_inquiries_select_own
  ON public.contact_inquiries
  FOR SELECT
  TO authenticated
  USING (decorator_profile_id = public.current_decorator_profile_id());

CREATE POLICY contact_inquiries_insert_published_target
  ON public.contact_inquiries
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.decorator_profiles dp
      WHERE dp.id = contact_inquiries.decorator_profile_id
        AND dp.is_published = true
    )
  );

CREATE POLICY contact_inquiries_admin_select
  ON public.contact_inquiries
  FOR SELECT
  TO authenticated
  USING (public.is_admin());
