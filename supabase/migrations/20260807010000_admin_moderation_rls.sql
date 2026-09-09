-- EventBook admin moderation (S-04: admin-moderation, phase 1)
-- Closes the admin-SELECT gap on portfolio_entries and its storage objects.
-- Admin write access already exists (portfolio_entries_admin_update_moderation);
-- admin could not previously list or view other decorators' non-approved entries.

CREATE POLICY portfolio_entries_select_admin
  ON public.portfolio_entries
  FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY portfolio_select_admin
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'portfolio'
    AND is_admin()
  );
