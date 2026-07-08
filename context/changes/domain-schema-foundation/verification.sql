-- EventBook domain schema — RLS smoke checks
-- Run after migrations apply: npx supabase db reset (local) or
--   npx supabase db query --linked -f context/changes/domain-schema-foundation/verification.sql (remote)
--
-- Manual role tests (Studio SQL editor or psql):
--   1. Create two auth users (signup via app).
--   2. As user A: insert unpublished profile → anon must not see it.
--   3. Publish profile → anon can SELECT profile and INSERT inquiry.
--   4. As user B: SELECT from contact_inquiries must return zero rows for A's profile.

-- Structural checks (no auth context required)

DO $$
DECLARE
  rls_enabled integer;
  policy_count integer;
BEGIN
  SELECT count(*)
  INTO rls_enabled
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN ('decorator_profiles', 'portfolio_entries', 'contact_inquiries')
    AND rowsecurity = true;

  IF rls_enabled <> 3 THEN
    RAISE EXCEPTION 'Expected RLS on 3 tables, found %', rls_enabled;
  END IF;

  SELECT count(*)
  INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('decorator_profiles', 'portfolio_entries', 'contact_inquiries');

  IF policy_count < 14 THEN
    RAISE EXCEPTION 'Expected at least 14 RLS policies, found %', policy_count;
  END IF;

  RAISE NOTICE 'RLS smoke OK: % tables with RLS, % policies', rls_enabled, policy_count;
END;
$$;

-- Helper functions exist

DO $$
BEGIN
  IF to_regprocedure('public.is_admin()') IS NULL THEN
    RAISE EXCEPTION 'Missing function public.is_admin()';
  END IF;

  IF to_regprocedure('public.current_decorator_profile_id()') IS NULL THEN
    RAISE EXCEPTION 'Missing function public.current_decorator_profile_id()';
  END IF;

  RAISE NOTICE 'Helper functions OK';
END;
$$;

-- Fixture for behavioral RLS checks (2.3, 2.4)

DO $$
DECLARE
  instance_id uuid;
  user_a_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  user_b_id uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  profile_a_id uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
BEGIN
  SELECT id INTO instance_id FROM auth.instances LIMIT 1;

  IF instance_id IS NULL THEN
    instance_id := '00000000-0000-0000-0000-000000000000';
  END IF;

  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  VALUES
    (
      user_a_id,
      instance_id,
      'authenticated',
      'authenticated',
      'rls-test-a@eventbook.local',
      crypt('test-password', gen_salt('bf')),
      now(),
      '{}'::jsonb,
      '{}'::jsonb,
      now(),
      now()
    ),
    (
      user_b_id,
      instance_id,
      'authenticated',
      'authenticated',
      'rls-test-b@eventbook.local',
      crypt('test-password', gen_salt('bf')),
      now(),
      '{}'::jsonb,
      '{}'::jsonb,
      now(),
      now()
    )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.decorator_profiles (id, user_id, company_name, city, is_published)
  VALUES (profile_a_id, user_a_id, 'RLS Test Decorator A', 'Warsaw', false)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.contact_inquiries (
    decorator_profile_id,
    client_name,
    client_email,
    event_date,
    needs_description
  )
  SELECT
    profile_a_id,
    'Smoke Test Client',
    'client@eventbook.local',
    current_date + 30,
    'Verification inquiry'
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.contact_inquiries
    WHERE decorator_profile_id = profile_a_id
      AND client_email = 'client@eventbook.local'
  );

  RAISE NOTICE 'RLS test fixture ready';
END;
$$;

-- 2.3: anon cannot read unpublished profiles

DO $$
DECLARE
  profile_a_id uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  visible_count integer;
BEGIN
  SET LOCAL role anon;

  SELECT count(*) INTO visible_count
  FROM public.decorator_profiles
  WHERE id = profile_a_id;

  IF visible_count <> 0 THEN
    RAISE EXCEPTION '2.3 failed: anon saw % unpublished profile row(s)', visible_count;
  END IF;

  RAISE NOTICE '2.3 OK: anon cannot read unpublished profiles';
END;
$$;

-- 2.4: decorator B cannot read decorator A inquiries

DO $$
DECLARE
  user_b_id uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  profile_a_id uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  visible_count integer;
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', user_b_id::text, 'role', 'authenticated')::text,
    true
  );
  SET LOCAL role authenticated;

  SELECT count(*) INTO visible_count
  FROM public.contact_inquiries
  WHERE decorator_profile_id = profile_a_id;

  IF visible_count <> 0 THEN
    RAISE EXCEPTION '2.4 failed: decorator B saw % inquiry row(s) for decorator A', visible_count;
  END IF;

  RAISE NOTICE '2.4 OK: cross-decorator inquiry isolation';
END;
$$;
