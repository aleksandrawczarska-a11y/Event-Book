-- EventBook domain schema (F-01: domain-schema-foundation, phase 1)
-- Tables only; RLS policies added in a follow-up migration.

CREATE TYPE public.moderation_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.decorator_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  company_name text NOT NULL,
  profile_photo_url text,
  description text,
  city text NOT NULL,
  instagram_url text,
  contact_email text,
  contact_phone text,
  event_types text[] NOT NULL DEFAULT ARRAY[]::text[],
  decoration_styles text[] NOT NULL DEFAULT ARRAY[]::text[],
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.portfolio_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decorator_profile_id uuid NOT NULL REFERENCES public.decorator_profiles (id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  event_description text,
  decoration_style text,
  location text,
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  moderation_status public.moderation_status NOT NULL DEFAULT 'approved',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.contact_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decorator_profile_id uuid NOT NULL REFERENCES public.decorator_profiles (id) ON DELETE CASCADE,
  client_name text NOT NULL,
  client_email text NOT NULL,
  client_phone text,
  event_date date NOT NULL,
  needs_description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX decorator_profiles_city_idx ON public.decorator_profiles (city);
CREATE INDEX decorator_profiles_event_types_idx ON public.decorator_profiles USING gin (event_types);
CREATE INDEX decorator_profiles_decoration_styles_idx ON public.decorator_profiles USING gin (decoration_styles);
CREATE INDEX portfolio_entries_decorator_profile_id_idx ON public.portfolio_entries (decorator_profile_id);
CREATE INDEX contact_inquiries_decorator_profile_id_created_at_idx
  ON public.contact_inquiries (decorator_profile_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER decorator_profiles_set_updated_at
  BEFORE UPDATE ON public.decorator_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
