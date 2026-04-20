-- 00004: Add sectors table + sector_id to profiles + updated RPCs
-- Run this in Supabase SQL Editor after 00003
-- This file is fully idempotent: safe to re-run any number of times

-- ============================================================
-- STEP 1: Drop ALL old versions of functions we're replacing
-- This MUST come first to avoid signature conflicts
-- ============================================================
DROP FUNCTION IF EXISTS public.register_and_book(text, text, text, text, uuid, uuid, text, boolean);
DROP FUNCTION IF EXISTS public.register_and_book(text, text, text, text, uuid, uuid, text, boolean, uuid);
DROP FUNCTION IF EXISTS public.admin_create_user(text, text, text, text, text, boolean);
DROP FUNCTION IF EXISTS public.admin_create_user(text, text, text, text, text, boolean, uuid);
DROP FUNCTION IF EXISTS public.get_trip_passengers(uuid);

-- ============================================================
-- STEP 2: Create sectors table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sectors_active ON public.sectors(is_active) WHERE is_active = true;

-- ============================================================
-- STEP 3: Seed the 16 sectors (idempotent — skips existing)
-- ============================================================
INSERT INTO public.sectors (name, code, sort_order)
SELECT v.name, v.code, v.sort_order
FROM (VALUES
  ('ابونا بيشوى كامل', '01', 1),
  ('ابونا فلتاؤوس', '02', 2),
  ('اغابى', '03', 3),
  ('استقبال', '04', 4),
  ('داون', '05', 5),
  ('مسنين', '06', 6),
  ('علاج طبيعى', '07', 7),
  ('فيصل - حركى', '08', 8),
  ('ترسا - حركى', '09', 9),
  ('مارمينا طالبية - حركى', '10', 10),
  ('مارمرقس طالبية - حركى', '11', 11),
  ('خدمه مدارس احد', '12', 12),
  ('خدمه ترانيم', '13', 13),
  ('اسره المحبه', '14', 14),
  ('عام', '15', 15),
  ('تدريب', '16', 16)
) AS v(name, code, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.sectors WHERE code = v.code);

-- ============================================================
-- STEP 4: Add sector_id column to profiles (idempotent)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'sector_id'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN sector_id uuid REFERENCES public.sectors(id) ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_profiles_sector ON public.profiles(sector_id) WHERE sector_id IS NOT NULL;

-- ============================================================
-- STEP 5: RLS on sectors
-- ============================================================
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read sectors" ON public.sectors;
DROP POLICY IF EXISTS "Admins can manage sectors" ON public.sectors;

CREATE POLICY "Authenticated users can read sectors"
  ON public.sectors FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage sectors"
  ON public.sectors FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- STEP 6: handle_new_user() — add sector_id
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, phone, full_name, gender, role, has_wheelchair, sector_id)
  VALUES (
    NEW.id,
    split_part(NEW.email, '@', 1),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'gender', 'Male'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'patient'),
    COALESCE((NEW.raw_user_meta_data->>'has_wheelchair')::boolean, false),
    COALESCE((NEW.raw_user_meta_data->>'sector_id')::uuid, NULL)
  );
  RETURN NEW;
END;
$$;

-- ============================================================
-- STEP 7: New RPC — get_sectors()
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_sectors()
RETURNS TABLE(id uuid, name text, code text, is_active boolean, sort_order int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
    SELECT s.id, s.name, s.code, s.is_active, s.sort_order
    FROM public.sectors s
    WHERE s.is_active = true
    ORDER BY s.sort_order;
END;
$$;

-- ============================================================
-- STEP 8: New RPC — update_own_sector()
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_own_sector(p_sector_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF p_sector_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.sectors WHERE id = p_sector_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Invalid sector';
  END IF;
  UPDATE public.profiles SET sector_id = p_sector_id WHERE id = auth.uid();
END;
$$;

-- ============================================================
-- STEP 9: register_and_book() — with p_sector_id
-- ============================================================
CREATE FUNCTION public.register_and_book(
  p_phone text,
  p_full_name text,
  p_gender text,
  p_password text,
  p_trip_id uuid DEFAULT NULL,
  p_bus_id uuid DEFAULT NULL,
  p_role text DEFAULT 'patient',
  p_has_wheelchair boolean DEFAULT false,
  p_sector_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  new_user_id uuid;
  v_capacity int;
  v_current int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin users can register new people';
  END IF;

  IF p_role NOT IN ('patient', 'companion', 'family_assistant', 'admin', 'servant') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_user_meta_data
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    p_phone || '@church.local',
    crypt(p_password, gen_salt('bf')),
    now(), now(), now(),
    jsonb_build_object(
      'full_name', p_full_name,
      'gender', p_gender,
      'role', COALESCE(p_role, 'patient'),
      'has_wheelchair', p_has_wheelchair,
      'sector_id', p_sector_id
    )
  ) RETURNING id INTO new_user_id;

  IF p_trip_id IS NOT NULL AND p_bus_id IS NOT NULL THEN
    SELECT capacity INTO v_capacity FROM public.buses WHERE id = p_bus_id FOR UPDATE;
    SELECT COUNT(*) INTO v_current FROM public.bookings WHERE bus_id = p_bus_id AND cancelled_at IS NULL;

    IF v_current >= v_capacity THEN
      RAISE EXCEPTION 'Bus is full';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.trips WHERE id = p_trip_id AND is_open = true) THEN
      RAISE EXCEPTION 'Trip is not open';
    END IF;

    IF EXISTS (SELECT 1 FROM public.bookings WHERE user_id = new_user_id AND trip_id = p_trip_id AND cancelled_at IS NULL) THEN
      RAISE EXCEPTION 'Already booked this trip';
    END IF;

    INSERT INTO public.bookings (user_id, trip_id, bus_id) VALUES (new_user_id, p_trip_id, p_bus_id);
  END IF;

  RETURN new_user_id;
END;
$$;

-- ============================================================
-- STEP 10: admin_create_user() — with p_sector_id
-- ============================================================
CREATE FUNCTION public.admin_create_user(
  p_phone text,
  p_full_name text,
  p_gender text,
  p_password text,
  p_role text,
  p_has_wheelchair boolean DEFAULT false,
  p_sector_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  new_user_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin users can create users';
  END IF;

  IF p_role NOT IN ('admin', 'servant', 'patient', 'companion', 'family_assistant') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  IF p_role IN ('admin') AND EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only super admin can create admin users';
  END IF;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_user_meta_data
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    p_phone || '@church.local',
    crypt(p_password, gen_salt('bf')),
    now(), now(), now(),
    jsonb_build_object(
      'full_name', p_full_name,
      'gender', p_gender,
      'role', p_role,
      'has_wheelchair', p_has_wheelchair,
      'sector_id', p_sector_id
    )
  ) RETURNING id INTO new_user_id;

  RETURN new_user_id;
END;
$$;

-- ============================================================
-- STEP 11: get_trip_passengers() — with sector_name + gender
-- ============================================================
CREATE FUNCTION public.get_trip_passengers(p_trip_id uuid)
RETURNS TABLE(
  bus_id uuid,
  full_name text,
  has_wheelchair boolean,
  gender text,
  sector_name text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
    SELECT
      b.bus_id,
      p.full_name,
      p.has_wheelchair,
      p.gender,
      COALESCE(s.name, '') AS sector_name
    FROM public.bookings b
    JOIN public.profiles p ON p.id = b.user_id
    LEFT JOIN public.sectors s ON s.id = p.sector_id
    WHERE b.trip_id = p_trip_id
      AND b.cancelled_at IS NULL
      AND p.deleted_at IS NULL
    ORDER BY p.full_name;
END;
$$;
