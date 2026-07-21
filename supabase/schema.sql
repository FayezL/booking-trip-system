-- =============================================================
-- Booking-Trip System: Consolidated Schema
-- Run on a fresh Supabase project. Idempotent.
-- Consolidated from migrations 00001–00101.
-- Final state only: no ALTER chains, no DROP/CREATE policy churn.
-- =============================================================

BEGIN;

-- =============================================================
-- TABLES
-- ============================================================

-- ---------- 1. areas ----------
CREATE TABLE IF NOT EXISTS public.areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar text NOT NULL,
  name_en text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 4,
  created_at timestamptz DEFAULT now(),
  UNIQUE (name_ar, name_en)
);
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;

-- ---------- 2. sectors ----------
CREATE TABLE IF NOT EXISTS public.sectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;

-- ---------- 3. trips ----------
CREATE TABLE IF NOT EXISTS public.trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_ar text NOT NULL,
  title_en text NOT NULL,
  trip_date date NOT NULL,
  is_open boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

-- ---------- 4. demo_account_pool ----------
-- No RLS policies => invisible to direct queries from anon/authenticated.
-- Access is via the SECURITY DEFINER function claim_demo_account().
CREATE TABLE IF NOT EXISTS public.demo_account_pool (
  phone text PRIMARY KEY,
  last_assigned_at timestamptz
);
ALTER TABLE public.demo_account_pool ENABLE ROW LEVEL SECURITY;

-- ---------- 5. profiles ----------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text UNIQUE NOT NULL,
  full_name text NOT NULL,
  gender text NOT NULL CHECK (gender IN ('Male', 'Female')),
  role text NOT NULL DEFAULT 'patient'
    CHECK (role IN ('super_admin', 'admin', 'servant', 'patient', 'companion', 'family_assistant', 'trainee')),
  has_wheelchair boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  -- 00004: sector membership
  sector_id uuid REFERENCES public.sectors(id) ON DELETE SET NULL,
  -- 00006: car owner attributes
  has_car boolean NOT NULL DEFAULT false,
  car_seats int CHECK (car_seats IS NULL OR car_seats > 0),
  -- 00009_user_profile_enhancements: trip preferences
  transport_type text NOT NULL DEFAULT 'bus'
    CHECK (transport_type IN ('private', 'bus')),
  servants_needed int NOT NULL DEFAULT 0
    CHECK (servants_needed IN (0, 1, 2))
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ---------- 6. family_members ----------
CREATE TABLE IF NOT EXISTS public.family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  head_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  gender text NOT NULL CHECK (gender IN ('Male', 'Female')),
  has_wheelchair boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- 00101: head/member distinction + per-person trip preferences
  is_head boolean NOT NULL DEFAULT false,
  phone text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'patient'
    CHECK (role IN ('patient', 'servant', 'companion', 'family_assistant', 'trainee')),
  transport_type text NOT NULL DEFAULT 'bus'
    CHECK (transport_type IN ('private', 'bus')),
  servants_needed int NOT NULL DEFAULT 0
    CHECK (servants_needed IN (0, 1, 2)),
  room_floor text CHECK (room_floor IS NULL OR room_floor IN ('ground', 'upper')),
  room_section text CHECK (room_section IS NULL OR room_section IN ('Male', 'Female', 'Families'))
);
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

-- ---------- 7. buses ----------
CREATE TABLE IF NOT EXISTS public.buses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  area_name_ar text NOT NULL,
  area_name_en text NOT NULL,
  capacity int NOT NULL CHECK (capacity > 0),
  leader_name text,
  area_id uuid REFERENCES public.areas(id) ON DELETE SET NULL,
  bus_label text
);
ALTER TABLE public.buses ENABLE ROW LEVEL SECURITY;

-- ---------- 8. rooms ----------
CREATE TABLE IF NOT EXISTS public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  room_type text NOT NULL CHECK (room_type IN ('Male', 'Female')),
  capacity int NOT NULL CHECK (capacity > 0),
  supervisor_name text,
  room_label text NOT NULL
);
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- ---------- 9. cars ----------
CREATE TABLE IF NOT EXISTS public.cars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  capacity int NOT NULL CHECK (capacity > 0),
  car_label text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;

-- ---------- 10. bookings ----------
-- bus_id is nullable (since 00006) to support trip-only and car bookings.
-- user_id / trip_id / bus_id / room_id / car_id / family_member_id all use their final ON DELETE behavior.
CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  bus_id uuid REFERENCES public.buses(id) ON DELETE CASCADE,
  car_id uuid REFERENCES public.cars(id) ON DELETE SET NULL,
  room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  family_member_id uuid REFERENCES public.family_members(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  cancelled_at timestamptz
);
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- ---------- 11. admin_logs ----------
CREATE TABLE IF NOT EXISTS public.admin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- INDEXES
-- ============================================================

-- profiles
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone);
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at ON public.profiles(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_sector ON public.profiles(sector_id) WHERE sector_id IS NOT NULL;

-- sectors
CREATE INDEX IF NOT EXISTS idx_sectors_active ON public.sectors(is_active) WHERE is_active = true;

-- buses / rooms / trips / areas: no dedicated indexes in migrations

-- cars
CREATE INDEX IF NOT EXISTS idx_cars_trip ON public.cars(trip_id);
CREATE INDEX IF NOT EXISTS idx_cars_driver ON public.cars(driver_id) WHERE driver_id IS NOT NULL;

-- bookings
-- Two partial unique indexes enforce "one active head booking per trip" and
-- "one active booking per family_member per trip". Replaces idx_bookings_unique_active (dropped in 00009).
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_head_unique
  ON public.bookings(user_id, trip_id)
  WHERE cancelled_at IS NULL AND family_member_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_family_unique
  ON public.bookings(user_id, trip_id, family_member_id)
  WHERE cancelled_at IS NULL AND family_member_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_trip_id ON public.bookings(trip_id);
CREATE INDEX IF NOT EXISTS idx_bookings_bus_id ON public.bookings(bus_id);
CREATE INDEX IF NOT EXISTS idx_bookings_room_id ON public.bookings(room_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_car_id ON public.bookings(car_id) WHERE car_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_family_member_id ON public.bookings(family_member_id) WHERE family_member_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_trip_active ON public.bookings(trip_id) WHERE cancelled_at IS NULL;

-- admin_logs
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON public.admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON public.admin_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON public.admin_logs(action);

-- family_members
CREATE INDEX IF NOT EXISTS idx_family_members_head ON public.family_members(head_user_id);

-- =============================================================
-- FUNCTIONS
-- ============================================================

-- ---------- Helper: is_admin() [final form from 00002] ----------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
      AND deleted_at IS NULL
  );
$$;

-- ---------- Auth trigger handler [final form from 00101: auto-creates profile + head family_member] ----------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, phone, full_name, gender, role, has_wheelchair,
    sector_id, transport_type, servants_needed
  ) VALUES (
    NEW.id,
    split_part(NEW.email, '@', 1),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'gender', 'Male'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'patient'),
    COALESCE((NEW.raw_user_meta_data->>'has_wheelchair')::boolean, false),
    COALESCE((NEW.raw_user_meta_data->>'sector_id')::uuid, NULL),
    COALESCE(NEW.raw_user_meta_data->>'transport_type', 'bus'),
    COALESCE((NEW.raw_user_meta_data->>'servants_needed')::int, 0)
  );

  IF COALESCE(NEW.raw_user_meta_data->>'role', 'patient') NOT IN ('super_admin', 'admin') THEN
    INSERT INTO public.family_members (
      head_user_id, full_name, gender, has_wheelchair, is_head,
      role, transport_type, servants_needed
    ) VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'gender', 'Male'),
      COALESCE((NEW.raw_user_meta_data->>'has_wheelchair')::boolean, false),
      true,
      COALESCE(NEW.raw_user_meta_data->>'role', 'patient'),
      COALESCE(NEW.raw_user_meta_data->>'transport_type', 'bus'),
      COALESCE((NEW.raw_user_meta_data->>'servants_needed')::int, 0)
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ---------- Sector RPCs [from 00004] ----------
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

-- ---------- register_and_book [final from 00009_user_profile_enhancements: sector_id + transport + trainee] ----------
CREATE OR REPLACE FUNCTION public.register_and_book(
  p_phone text,
  p_full_name text,
  p_gender text,
  p_password text,
  p_trip_id uuid DEFAULT NULL,
  p_bus_id uuid DEFAULT NULL,
  p_role text DEFAULT 'patient',
  p_has_wheelchair boolean DEFAULT false,
  p_sector_id uuid DEFAULT NULL,
  p_transport_type text DEFAULT 'bus',
  p_servants_needed int DEFAULT 0
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

  IF p_role NOT IN ('patient', 'companion', 'family_assistant', 'admin', 'servant', 'trainee') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  IF p_transport_type NOT IN ('private', 'bus') THEN
    RAISE EXCEPTION 'Invalid transport type';
  END IF;

  IF p_servants_needed NOT IN (0, 1, 2) THEN
    RAISE EXCEPTION 'Invalid servants needed count';
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
      'sector_id', p_sector_id,
      'transport_type', p_transport_type,
      'servants_needed', p_servants_needed
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

-- ---------- admin_create_user [final from 00009_user_profile_enhancements] ----------
CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_phone text,
  p_full_name text,
  p_gender text,
  p_password text,
  p_role text,
  p_has_wheelchair boolean DEFAULT false,
  p_sector_id uuid DEFAULT NULL,
  p_transport_type text DEFAULT 'bus',
  p_servants_needed int DEFAULT 0
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

  IF p_role NOT IN ('admin', 'servant', 'patient', 'companion', 'family_assistant', 'trainee') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  IF p_role IN ('admin') AND EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only super admin can create admin users';
  END IF;

  IF p_transport_type NOT IN ('private', 'bus') THEN
    RAISE EXCEPTION 'Invalid transport type';
  END IF;

  IF p_servants_needed NOT IN (0, 1, 2) THEN
    RAISE EXCEPTION 'Invalid servants needed count';
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
      'sector_id', p_sector_id,
      'transport_type', p_transport_type,
      'servants_needed', p_servants_needed
    )
  ) RETURNING id INTO new_user_id;

  RETURN new_user_id;
END;
$$;

-- ---------- admin_delete_user [final from 00007: HARD delete] ----------
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin users can delete users';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id AND role = 'super_admin') THEN
    RAISE EXCEPTION 'Cannot delete super admin';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id AND role = 'admin')
  ) THEN
    RAISE EXCEPTION 'Admins cannot delete other admins';
  END IF;

  DELETE FROM public.bookings WHERE user_id = p_user_id;
  DELETE FROM public.profiles WHERE id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

-- ---------- admin_reset_password [from 00001/00003] ----------
CREATE OR REPLACE FUNCTION public.admin_reset_password(p_user_id uuid, p_new_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin users can reset passwords';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id AND role = 'super_admin') THEN
    RAISE EXCEPTION 'Cannot reset super admin password';
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf'))
  WHERE id = p_user_id;
END;
$$;

-- ---------- move_passenger_bus [from 00002] ----------
CREATE OR REPLACE FUNCTION public.move_passenger_bus(
  p_booking_id uuid,
  p_new_bus_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_trip_id uuid;
  v_current_bus_id uuid;
  v_capacity int;
  v_current int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin users can move passengers';
  END IF;

  SELECT trip_id, bus_id INTO v_trip_id, v_current_bus_id
  FROM public.bookings
  WHERE id = p_booking_id AND cancelled_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found or cancelled';
  END IF;

  IF v_current_bus_id = p_new_bus_id THEN
    RAISE EXCEPTION 'Passenger is already on this bus';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.buses
    WHERE id = p_new_bus_id AND trip_id = v_trip_id
  ) THEN
    RAISE EXCEPTION 'Target bus not found or not in same trip';
  END IF;

  SELECT capacity INTO v_capacity
  FROM public.buses WHERE id = p_new_bus_id FOR UPDATE;

  SELECT COUNT(*) INTO v_current
  FROM public.bookings
  WHERE bus_id = p_new_bus_id AND cancelled_at IS NULL;

  IF v_current >= v_capacity THEN
    RAISE EXCEPTION 'Target bus is full';
  END IF;

  UPDATE public.bookings
  SET bus_id = p_new_bus_id, room_id = NULL
  WHERE id = p_booking_id;
END;
$$;

-- ---------- book_bus [final from 00101: uses head family_member row] ----------
CREATE OR REPLACE FUNCTION public.book_bus(
  p_user_id uuid,
  p_trip_id uuid,
  p_bus_id uuid
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_capacity int;
  v_current int;
  v_booking_id uuid;
  v_head_fm_id uuid;
BEGIN
  IF NOT public.is_admin() AND auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'You can only book for yourself';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.trips WHERE id = p_trip_id AND is_open = true) THEN
    RAISE EXCEPTION 'Trip is not open';
  END IF;

  SELECT id INTO v_head_fm_id FROM public.family_members
  WHERE head_user_id = p_user_id AND is_head = true;

  IF v_head_fm_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.bookings
      WHERE user_id = p_user_id AND trip_id = p_trip_id
        AND family_member_id = v_head_fm_id AND cancelled_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Already booked this trip';
    END IF;
  ELSE
    IF EXISTS (
      SELECT 1 FROM public.bookings
      WHERE user_id = p_user_id AND trip_id = p_trip_id
        AND family_member_id IS NULL AND cancelled_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Already booked this trip';
    END IF;
  END IF;

  SELECT capacity INTO v_capacity FROM public.buses WHERE id = p_bus_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bus not found'; END IF;

  SELECT COUNT(*) INTO v_current
  FROM public.bookings WHERE bus_id = p_bus_id AND cancelled_at IS NULL;

  IF v_current >= v_capacity THEN
    RAISE EXCEPTION 'Bus is full';
  END IF;

  IF v_head_fm_id IS NOT NULL THEN
    INSERT INTO public.bookings (user_id, trip_id, bus_id, family_member_id)
    VALUES (p_user_id, p_trip_id, p_bus_id, v_head_fm_id)
    RETURNING id INTO v_booking_id;
  ELSE
    INSERT INTO public.bookings (user_id, trip_id, bus_id)
    VALUES (p_user_id, p_trip_id, p_bus_id)
    RETURNING id INTO v_booking_id;
  END IF;

  RETURN v_booking_id;
END;
$$;

-- ---------- assign_room [final from 00009_family_members: uses fm.gender when applicable] ----------
CREATE OR REPLACE FUNCTION public.assign_room(
  p_booking_id uuid,
  p_room_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_gender text;
  v_room_type text;
  v_room_capacity int;
  v_current_occupants int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin users can assign rooms';
  END IF;

  SELECT COALESCE(fm.gender, p.gender) INTO v_gender
  FROM public.bookings b
  JOIN public.profiles p ON p.id = b.user_id
  LEFT JOIN public.family_members fm ON fm.id = b.family_member_id
  WHERE b.id = p_booking_id AND b.cancelled_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found or cancelled';
  END IF;

  SELECT room_type, capacity INTO v_room_type, v_room_capacity
  FROM public.rooms WHERE id = p_room_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  IF v_gender != v_room_type THEN
    RAISE EXCEPTION 'Gender mismatch: user is % but room is %', v_gender, v_room_type;
  END IF;

  SELECT COUNT(*) INTO v_current_occupants
  FROM public.bookings
  WHERE room_id = p_room_id AND cancelled_at IS NULL;

  IF v_current_occupants >= v_room_capacity THEN
    RAISE EXCEPTION 'Room is full';
  END IF;

  UPDATE public.bookings SET room_id = p_room_id WHERE id = p_booking_id;
END;
$$;

-- ---------- cancel_booking [final from 00101: independent per person, no family cascade] ----------
CREATE OR REPLACE FUNCTION public.cancel_booking(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_car_id uuid;
BEGIN
  SELECT user_id, car_id INTO v_user_id, v_car_id
  FROM public.bookings WHERE id = p_booking_id AND cancelled_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found or already cancelled';
  END IF;

  IF NOT public.is_admin() AND auth.uid() != v_user_id THEN
    RAISE EXCEPTION 'You can only cancel your own booking';
  END IF;

  UPDATE public.bookings
  SET cancelled_at = now(), room_id = NULL, car_id = NULL
  WHERE id = p_booking_id AND cancelled_at IS NULL;

  IF v_car_id IS NOT NULL THEN
    DELETE FROM public.cars WHERE id = v_car_id;
  END IF;
END;
$$;

-- ---------- get_trip_passengers [final from 00101: returns all new fields] ----------
CREATE OR REPLACE FUNCTION public.get_trip_passengers(p_trip_id uuid)
RETURNS TABLE(
  bus_id uuid,
  full_name text,
  has_wheelchair boolean,
  gender text,
  sector_name text,
  family_member_id uuid,
  head_user_id uuid,
  role text,
  transport_type text,
  room_floor text,
  room_section text,
  is_head boolean
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
    SELECT
      b.bus_id,
      COALESCE(fm.full_name, p.full_name) AS full_name,
      COALESCE(fm.has_wheelchair, p.has_wheelchair) AS has_wheelchair,
      COALESCE(fm.gender, p.gender) AS gender,
      s.name AS sector_name,
      b.family_member_id,
      b.user_id AS head_user_id,
      COALESCE(fm.role, p.role) AS role,
      COALESCE(fm.transport_type, p.transport_type) AS transport_type,
      fm.room_floor,
      fm.room_section,
      COALESCE(fm.is_head, false) AS is_head
    FROM public.bookings b
    JOIN public.profiles p ON p.id = b.user_id
    LEFT JOIN public.family_members fm ON fm.id = b.family_member_id
    LEFT JOIN public.sectors s ON s.id = p.sector_id
    WHERE b.trip_id = p_trip_id
      AND b.cancelled_at IS NULL
      AND p.deleted_at IS NULL
    ORDER BY p.full_name, fm.created_at;
END;
$$;

-- ---------- Cars RPCs [from 00006_part2; book_with_car superseded by 00101 below] ----------

CREATE OR REPLACE FUNCTION public.update_own_car_settings(
  p_has_car boolean,
  p_car_seats int
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  UPDATE public.profiles
  SET has_car = p_has_car,
      car_seats = CASE WHEN p_has_car THEN p_car_seats ELSE NULL END
  WHERE id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_car_settings(
  p_user_id uuid,
  p_has_car boolean,
  p_car_seats int
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin users can update car settings';
  END IF;

  UPDATE public.profiles
  SET has_car = p_has_car,
      car_seats = CASE WHEN p_has_car THEN p_car_seats ELSE NULL END
  WHERE id = p_user_id;
END;
$$;

-- book_with_car [final from 00101: uses head family_member row]
CREATE OR REPLACE FUNCTION public.book_with_car(
  p_trip_id uuid
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_car_id uuid;
  v_booking_id uuid;
  v_head_fm_id uuid;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF v_profile.has_car IS NOT TRUE THEN
    RAISE EXCEPTION 'You do not have a car registered';
  END IF;

  IF v_profile.car_seats IS NULL OR v_profile.car_seats < 1 THEN
    RAISE EXCEPTION 'Invalid car seat count';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.trips WHERE id = p_trip_id AND is_open = true) THEN
    RAISE EXCEPTION 'Trip is not open';
  END IF;

  SELECT id INTO v_head_fm_id FROM public.family_members
  WHERE head_user_id = auth.uid() AND is_head = true;

  IF v_head_fm_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.bookings
      WHERE user_id = auth.uid() AND trip_id = p_trip_id
        AND family_member_id = v_head_fm_id AND cancelled_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Already booked this trip';
    END IF;
  ELSE
    IF EXISTS (
      SELECT 1 FROM public.bookings
      WHERE user_id = auth.uid() AND trip_id = p_trip_id AND cancelled_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Already booked this trip';
    END IF;
  END IF;

  INSERT INTO public.cars (trip_id, driver_id, capacity, car_label)
  VALUES (p_trip_id, auth.uid(), v_profile.car_seats, v_profile.full_name || ' car')
  RETURNING id INTO v_car_id;

  IF v_head_fm_id IS NOT NULL THEN
    INSERT INTO public.bookings (user_id, trip_id, car_id, family_member_id)
    VALUES (auth.uid(), p_trip_id, v_car_id, v_head_fm_id)
    RETURNING id INTO v_booking_id;
  ELSE
    INSERT INTO public.bookings (user_id, trip_id, car_id)
    VALUES (auth.uid(), p_trip_id, v_car_id)
    RETURNING id INTO v_booking_id;
  END IF;

  RETURN v_booking_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_car_passenger(
  p_booking_id uuid,
  p_car_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_trip_id uuid;
  v_car_trip_id uuid;
  v_car_capacity int;
  v_car_taken int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin users can assign car passengers';
  END IF;

  SELECT trip_id INTO v_trip_id
  FROM public.bookings WHERE id = p_booking_id AND cancelled_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found or cancelled';
  END IF;

  SELECT trip_id, capacity INTO v_car_trip_id, v_car_capacity
  FROM public.cars WHERE id = p_car_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Car not found';
  END IF;

  IF v_car_trip_id != v_trip_id THEN
    RAISE EXCEPTION 'Car does not belong to this trip';
  END IF;

  SELECT COUNT(*) INTO v_car_taken
  FROM public.bookings
  WHERE car_id = p_car_id AND cancelled_at IS NULL;

  IF v_car_taken >= v_car_capacity THEN
    RAISE EXCEPTION 'Car is full';
  END IF;

  UPDATE public.bookings
  SET car_id = p_car_id, bus_id = NULL, room_id = NULL
  WHERE id = p_booking_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_car(p_car_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin users can remove cars';
  END IF;

  DELETE FROM public.cars WHERE id = p_car_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_car(
  p_trip_id uuid,
  p_driver_id uuid,
  p_capacity int
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_car_id uuid;
  v_driver_name text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin users can create cars';
  END IF;

  SELECT full_name INTO v_driver_name FROM public.profiles WHERE id = p_driver_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Driver not found';
  END IF;

  INSERT INTO public.cars (trip_id, driver_id, capacity, car_label)
  VALUES (p_trip_id, p_driver_id, p_capacity, v_driver_name || ' car')
  RETURNING id INTO v_car_id;

  RETURN v_car_id;
END;
$$;

-- ---------- Family member RPCs [add/update/get final from 00101; remove from 00009] ----------

CREATE OR REPLACE FUNCTION public.add_family_member(
  p_head_user_id uuid,
  p_full_name text,
  p_gender text,
  p_has_wheelchair boolean DEFAULT false,
  p_phone text DEFAULT '',
  p_role text DEFAULT 'patient',
  p_transport_type text DEFAULT 'bus',
  p_servants_needed int DEFAULT 0,
  p_room_floor text DEFAULT NULL,
  p_room_section text DEFAULT NULL,
  p_is_head boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.is_admin() AND auth.uid() != p_head_user_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_gender NOT IN ('Male', 'Female') THEN
    RAISE EXCEPTION 'Invalid gender';
  END IF;

  IF p_role NOT IN ('patient','servant','companion','family_assistant','trainee') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  IF p_transport_type NOT IN ('private','bus') THEN
    RAISE EXCEPTION 'Invalid transport type';
  END IF;

  IF p_servants_needed NOT IN (0, 1, 2) THEN
    RAISE EXCEPTION 'Invalid servants needed';
  END IF;

  IF p_room_floor IS NOT NULL AND p_room_floor NOT IN ('ground','upper') THEN
    RAISE EXCEPTION 'Invalid room floor';
  END IF;

  IF p_room_section IS NOT NULL AND p_room_section NOT IN ('Male','Female','Families') THEN
    RAISE EXCEPTION 'Invalid room section';
  END IF;

  INSERT INTO public.family_members (
    head_user_id, full_name, gender, has_wheelchair,
    phone, role, transport_type, servants_needed,
    room_floor, room_section, is_head
  ) VALUES (
    p_head_user_id, p_full_name, p_gender, p_has_wheelchair,
    p_phone, p_role, p_transport_type, p_servants_needed,
    p_room_floor, p_room_section, p_is_head
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_family_member(
  p_member_id uuid,
  p_full_name text,
  p_gender text,
  p_has_wheelchair boolean,
  p_phone text DEFAULT '',
  p_role text DEFAULT 'patient',
  p_transport_type text DEFAULT 'bus',
  p_servants_needed int DEFAULT 0,
  p_room_floor text DEFAULT NULL,
  p_room_section text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_head uuid;
BEGIN
  SELECT head_user_id INTO v_head FROM public.family_members WHERE id = p_member_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found'; END IF;

  IF NOT public.is_admin() AND auth.uid() != v_head THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_gender NOT IN ('Male', 'Female') THEN
    RAISE EXCEPTION 'Invalid gender';
  END IF;

  IF p_role NOT IN ('patient','servant','companion','family_assistant','trainee') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  IF p_transport_type NOT IN ('private','bus') THEN
    RAISE EXCEPTION 'Invalid transport type';
  END IF;

  IF p_servants_needed NOT IN (0, 1, 2) THEN
    RAISE EXCEPTION 'Invalid servants needed';
  END IF;

  UPDATE public.family_members
  SET full_name = p_full_name,
      gender = p_gender,
      has_wheelchair = p_has_wheelchair,
      phone = p_phone,
      role = p_role,
      transport_type = p_transport_type,
      servants_needed = p_servants_needed,
      room_floor = p_room_floor,
      room_section = p_room_section
  WHERE id = p_member_id;

  IF EXISTS (SELECT 1 FROM public.family_members WHERE id = p_member_id AND is_head = true) THEN
    UPDATE public.profiles
    SET full_name = p_full_name,
        gender = p_gender,
        has_wheelchair = p_has_wheelchair,
        transport_type = p_transport_type,
        servants_needed = p_servants_needed
    WHERE id = v_head;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_family_member(p_member_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_head uuid;
BEGIN
  SELECT head_user_id INTO v_head FROM public.family_members WHERE id = p_member_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found'; END IF;

  IF NOT public.is_admin() AND auth.uid() != v_head THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  DELETE FROM public.family_members WHERE id = p_member_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_family_members(p_user_id uuid DEFAULT NULL)
RETURNS TABLE(
  id uuid, head_user_id uuid, full_name text, gender text,
  has_wheelchair boolean, is_head boolean,
  phone text, role text, transport_type text,
  servants_needed int, room_floor text, room_section text,
  created_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    p_user_id := auth.uid();
  END IF;

  IF NOT public.is_admin() AND auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
    SELECT
      fm.id, fm.head_user_id, fm.full_name, fm.gender,
      fm.has_wheelchair, fm.is_head,
      fm.phone, fm.role, fm.transport_type,
      fm.servants_needed, fm.room_floor, fm.room_section,
      fm.created_at
    FROM public.family_members fm
    WHERE fm.head_user_id = p_user_id
    ORDER BY fm.is_head DESC, fm.created_at;
END;
$$;

-- ---------- book_bus_with_family [final from 00101: uniform — head is just a member] ----------
CREATE OR REPLACE FUNCTION public.book_bus_with_family(
  p_user_id uuid,
  p_trip_id uuid,
  p_bus_id uuid,
  p_family_member_ids uuid[]
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_capacity int;
  v_current int;
  v_needed int;
  v_booking_id uuid;
  v_valid_count int;
  v_fm_id uuid;
BEGIN
  IF NOT public.is_admin() AND auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'You can only book for yourself';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.trips WHERE id = p_trip_id AND is_open = true) THEN
    RAISE EXCEPTION 'Trip is not open';
  END IF;

  IF array_length(p_family_member_ids, 1) IS NULL OR array_length(p_family_member_ids, 1) = 0 THEN
    RAISE EXCEPTION 'Select at least one person';
  END IF;

  SELECT COUNT(*) INTO v_valid_count
  FROM public.family_members
  WHERE id = ANY(p_family_member_ids) AND head_user_id = p_user_id;

  IF v_valid_count != array_length(p_family_member_ids, 1) THEN
    RAISE EXCEPTION 'Invalid family member';
  END IF;

  FOR v_fm_id IN SELECT unnest(p_family_member_ids) LOOP
    IF EXISTS (
      SELECT 1 FROM public.bookings
      WHERE user_id = p_user_id AND trip_id = p_trip_id
        AND family_member_id = v_fm_id AND cancelled_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Person already booked this trip';
    END IF;
  END LOOP;

  SELECT capacity INTO v_capacity FROM public.buses WHERE id = p_bus_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bus not found'; END IF;

  SELECT COUNT(*) INTO v_current FROM public.bookings WHERE bus_id = p_bus_id AND cancelled_at IS NULL;

  v_needed := array_length(p_family_member_ids, 1);
  IF v_current + v_needed > v_capacity THEN
    RAISE EXCEPTION 'Bus is full — need % seats but only % available', v_needed, v_capacity - v_current;
  END IF;

  FOR v_fm_id IN SELECT unnest(p_family_member_ids) LOOP
    INSERT INTO public.bookings (user_id, trip_id, bus_id, family_member_id)
    VALUES (p_user_id, p_trip_id, p_bus_id, v_fm_id)
    RETURNING id INTO v_booking_id;
  END LOOP;

  RETURN v_booking_id;
END;
$$;

-- ---------- book_trip_only_with_family [final from 00101] ----------
CREATE OR REPLACE FUNCTION public.book_trip_only_with_family(
  p_user_id uuid,
  p_trip_id uuid,
  p_family_member_ids uuid[]
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_booking_id uuid;
  v_valid_count int;
  v_fm_id uuid;
BEGIN
  IF NOT public.is_admin() AND auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'You can only book for yourself';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.trips WHERE id = p_trip_id AND is_open = true) THEN
    RAISE EXCEPTION 'Trip is not open';
  END IF;

  IF array_length(p_family_member_ids, 1) IS NULL OR array_length(p_family_member_ids, 1) = 0 THEN
    RAISE EXCEPTION 'Select at least one person';
  END IF;

  SELECT COUNT(*) INTO v_valid_count
  FROM public.family_members
  WHERE id = ANY(p_family_member_ids) AND head_user_id = p_user_id;

  IF v_valid_count != array_length(p_family_member_ids, 1) THEN
    RAISE EXCEPTION 'Invalid family member';
  END IF;

  FOR v_fm_id IN SELECT unnest(p_family_member_ids) LOOP
    IF EXISTS (
      SELECT 1 FROM public.bookings
      WHERE user_id = p_user_id AND trip_id = p_trip_id
        AND family_member_id = v_fm_id AND cancelled_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Person already booked this trip';
    END IF;
  END LOOP;

  FOR v_fm_id IN SELECT unnest(p_family_member_ids) LOOP
    INSERT INTO public.bookings (user_id, trip_id, bus_id, car_id, family_member_id)
    VALUES (p_user_id, p_trip_id, NULL, NULL, v_fm_id)
    RETURNING id INTO v_booking_id;
  END LOOP;

  RETURN v_booking_id;
END;
$$;

-- ---------- Self-service profile RPCs [update_own_name + update_own_transport final from 00101; phone/password from 00009] ----------

CREATE OR REPLACE FUNCTION public.update_own_name(p_name text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'Name cannot be empty';
  END IF;

  UPDATE public.profiles
  SET full_name = trim(p_name)
  WHERE id = auth.uid();

  UPDATE public.family_members
  SET full_name = trim(p_name)
  WHERE head_user_id = auth.uid() AND is_head = true;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_own_phone(p_phone text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_current_phone text;
BEGIN
  IF p_phone IS NULL OR trim(p_phone) = '' THEN
    RAISE EXCEPTION 'Phone cannot be empty';
  END IF;

  IF NOT p_phone ~ '^\d{8,15}$' THEN
    RAISE EXCEPTION 'Invalid phone format';
  END IF;

  SELECT phone INTO v_current_phone FROM public.profiles WHERE id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF p_phone = v_current_phone THEN
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE phone = p_phone AND id != auth.uid()) THEN
    RAISE EXCEPTION 'Phone number already in use';
  END IF;

  UPDATE public.profiles SET phone = p_phone WHERE id = auth.uid();
  UPDATE auth.users SET email = p_phone || '@church.local' WHERE id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.update_own_transport(
  p_transport_type text,
  p_servants_needed int
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF p_transport_type NOT IN ('private', 'bus') THEN
    RAISE EXCEPTION 'Invalid transport type';
  END IF;

  IF p_servants_needed NOT IN (0, 1, 2) THEN
    RAISE EXCEPTION 'Invalid servants needed count';
  END IF;

  UPDATE public.profiles
  SET transport_type = p_transport_type,
      servants_needed = p_servants_needed
  WHERE id = auth.uid();

  UPDATE public.family_members
  SET transport_type = p_transport_type,
      servants_needed = p_servants_needed
  WHERE head_user_id = auth.uid() AND is_head = true;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_own_password(p_new_password text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF p_new_password IS NULL OR length(p_new_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf'))
  WHERE id = auth.uid();
END;
$$;

-- ---------- admin_get_user_details [from 00009_user_profile_enhancements] ----------
CREATE OR REPLACE FUNCTION public.admin_get_user_details(p_user_id uuid)
RETURNS TABLE(
  id uuid,
  phone text,
  full_name text,
  gender text,
  role text,
  has_wheelchair boolean,
  transport_type text,
  servants_needed int,
  sector_name text,
  has_car boolean,
  car_seats int,
  created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin users can view user details';
  END IF;

  RETURN QUERY
    SELECT
      p.id,
      p.phone,
      p.full_name,
      p.gender,
      p.role,
      p.has_wheelchair,
      p.transport_type,
      p.servants_needed,
      COALESCE(s.name, '') AS sector_name,
      p.has_car,
      p.car_seats,
      p.created_at
    FROM public.profiles p
    LEFT JOIN public.sectors s ON s.id = p.sector_id
    WHERE p.id = p_user_id
      AND p.deleted_at IS NULL;
END;
$$;

-- ---------- sync_head_member [from 00101] ----------
CREATE OR REPLACE FUNCTION public.sync_head_member(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  UPDATE public.family_members fm
  SET full_name = p.full_name,
      gender = p.gender,
      has_wheelchair = p.has_wheelchair,
      transport_type = p.transport_type,
      servants_needed = p.servants_needed
  FROM public.profiles p
  WHERE fm.head_user_id = p.id
    AND fm.is_head = true
    AND p.id = p_user_id;
END;
$$;

-- ---------- get_all_trips_stats [final from 00101: includes fm roles/transport] ----------
CREATE OR REPLACE FUNCTION public.get_all_trips_stats()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_total_registered int;
  v_result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT COUNT(*) INTO v_total_registered FROM public.profiles WHERE deleted_at IS NULL;

  SELECT jsonb_agg(row_data ORDER BY trip_date DESC) INTO v_result
  FROM (
    SELECT
      jsonb_build_object(
        'trip_id', t.id,
        'title_ar', t.title_ar,
        'title_en', t.title_en,
        'trip_date', t.trip_date,
        'is_open', t.is_open,
        'total_booked', stats.total_booked,
        'total_registered', v_total_registered,
        'by_role', stats.by_role,
        'by_gender', stats.by_gender,
        'by_transport', stats.by_transport,
        'wheelchair_count', stats.wheelchair_count,
        'family_members_count', stats.family_members_count,
        'by_sector', stats.by_sector,
        'transport_breakdown', stats.transport_breakdown,
        'servants_needed', stats.servants_needed,
        'bus_stats', stats.bus_stats,
        'room_stats', stats.room_stats
      ) AS row_data,
      t.trip_date
    FROM public.trips t
    CROSS JOIN LATERAL (
      SELECT
        COALESCE(
          (SELECT jsonb_object_agg(r, cnt) FROM (
            SELECT COALESCE(fm.role, p.role) AS r, COUNT(*) AS cnt
            FROM public.bookings b
            JOIN public.profiles p ON p.id = b.user_id
            LEFT JOIN public.family_members fm ON fm.id = b.family_member_id
            WHERE b.trip_id = t.id AND b.cancelled_at IS NULL AND p.deleted_at IS NULL
            GROUP BY COALESCE(fm.role, p.role)
          ) r),
          '{}'::jsonb
        ) AS by_role,

        COALESCE(
          (SELECT jsonb_build_object(
            'Male', COALESCE(SUM(CASE WHEN COALESCE(fm.gender, p.gender) = 'Male' THEN 1 ELSE 0 END), 0),
            'Female', COALESCE(SUM(CASE WHEN COALESCE(fm.gender, p.gender) = 'Female' THEN 1 ELSE 0 END), 0)
          )
          FROM public.bookings b
          JOIN public.profiles p ON p.id = b.user_id
          LEFT JOIN public.family_members fm ON fm.id = b.family_member_id
          WHERE b.trip_id = t.id AND b.cancelled_at IS NULL AND p.deleted_at IS NULL),
          '{"Male": 0, "Female": 0}'::jsonb
        ) AS by_gender,

        COALESCE(
          (SELECT jsonb_object_agg(transport_type, cnt) FROM (
            SELECT COALESCE(fm.transport_type, p.transport_type) AS transport_type, COUNT(*) AS cnt
            FROM public.bookings b
            JOIN public.profiles p ON p.id = b.user_id
            LEFT JOIN public.family_members fm ON fm.id = b.family_member_id
            WHERE b.trip_id = t.id AND b.cancelled_at IS NULL AND p.deleted_at IS NULL
            GROUP BY COALESCE(fm.transport_type, p.transport_type)
          ) r),
          '{}'::jsonb
        ) AS by_transport,

        COALESCE(
          (SELECT COUNT(*) FROM public.bookings b
           JOIN public.profiles p ON p.id = b.user_id
           LEFT JOIN public.family_members fm ON fm.id = b.family_member_id
           WHERE b.trip_id = t.id AND b.cancelled_at IS NULL AND p.deleted_at IS NULL
             AND COALESCE(fm.has_wheelchair, p.has_wheelchair) = true),
          0
        ) AS wheelchair_count,

        COALESCE(
          (SELECT COUNT(*) FROM public.bookings b
           WHERE b.trip_id = t.id AND b.cancelled_at IS NULL
             AND b.family_member_id IS NOT NULL),
          0
        ) AS family_members_count,

        COALESCE(
          (SELECT jsonb_agg(jsonb_build_object('name', sector_name, 'count', cnt)) FROM (
            SELECT COALESCE(s.name, 'Unassigned') AS sector_name, COUNT(*) AS cnt
            FROM public.bookings b
            JOIN public.profiles p ON p.id = b.user_id
            LEFT JOIN public.sectors s ON s.id = p.sector_id
            WHERE b.trip_id = t.id AND b.cancelled_at IS NULL AND p.deleted_at IS NULL
            GROUP BY s.name
          ) sec),
          '[]'::jsonb
        ) AS by_sector,

        COALESCE(
          (SELECT jsonb_build_object(
            'on_bus', COALESCE(SUM(CASE WHEN b.bus_id IS NOT NULL THEN 1 ELSE 0 END), 0),
            'in_car', COALESCE(SUM(CASE WHEN b.car_id IS NOT NULL THEN 1 ELSE 0 END), 0),
            'no_transport', COALESCE(SUM(CASE WHEN b.bus_id IS NULL AND b.car_id IS NULL THEN 1 ELSE 0 END), 0)
          )
          FROM public.bookings b
          WHERE b.trip_id = t.id AND b.cancelled_at IS NULL),
          '{"on_bus": 0, "in_car": 0, "no_transport": 0}'::jsonb
        ) AS transport_breakdown,

        COALESCE(
          (SELECT jsonb_build_object(
            '0', COALESCE(SUM(CASE WHEN COALESCE(fm.servants_needed, p.servants_needed) = 0 THEN 1 ELSE 0 END), 0),
            '1', COALESCE(SUM(CASE WHEN COALESCE(fm.servants_needed, p.servants_needed) = 1 THEN 1 ELSE 0 END), 0),
            '2', COALESCE(SUM(CASE WHEN COALESCE(fm.servants_needed, p.servants_needed) = 2 THEN 1 ELSE 0 END), 0)
          )
          FROM public.bookings b
          JOIN public.profiles p ON p.id = b.user_id
          LEFT JOIN public.family_members fm ON fm.id = b.family_member_id
          WHERE b.trip_id = t.id AND b.cancelled_at IS NULL AND p.deleted_at IS NULL),
          '{"0": 0, "1": 0, "2": 0}'::jsonb
        ) AS servants_needed,

        COALESCE(
          (SELECT jsonb_build_object(
            'total_seats', COALESCE(SUM(bus.capacity), 0),
            'filled', COALESCE(SUM(CASE WHEN b.id IS NOT NULL THEN 1 ELSE 0 END), 0)
          )
          FROM public.buses bus
          LEFT JOIN public.bookings b ON b.bus_id = bus.id AND b.cancelled_at IS NULL
          WHERE bus.trip_id = t.id),
          '{"total_seats": 0, "filled": 0}'::jsonb
        ) AS bus_stats,

        COALESCE(
          (SELECT jsonb_build_object(
            'total_capacity', COALESCE(SUM(r.capacity), 0),
            'assigned', COALESCE(SUM(CASE WHEN b.id IS NOT NULL THEN 1 ELSE 0 END), 0)
          )
          FROM public.rooms r
          LEFT JOIN public.bookings b ON b.room_id = r.id AND b.cancelled_at IS NULL
          WHERE r.trip_id = t.id),
          '{"total_capacity": 0, "assigned": 0}'::jsonb
        ) AS room_stats,

        (SELECT COUNT(*) FROM public.bookings b
         WHERE b.trip_id = t.id AND b.cancelled_at IS NULL) AS total_booked
    ) stats
  ) sub;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- ---------- claim_demo_account [from 00010] ----------
CREATE OR REPLACE FUNCTION public.claim_demo_account()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_phone text;
BEGIN
  -- Prefer accounts with NO active booking so the visitor can book fresh.
  SELECT p.phone INTO v_phone
  FROM public.demo_account_pool p
  JOIN public.profiles prof ON prof.phone = p.phone
  LEFT JOIN public.bookings b ON b.user_id = prof.id AND b.cancelled_at IS NULL
  WHERE b.id IS NULL
  ORDER BY p.last_assigned_at NULLS FIRST, p.phone
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  -- Fallback: every account already has a booking; return least-recently-assigned.
  IF v_phone IS NULL THEN
    SELECT phone INTO v_phone
    FROM public.demo_account_pool
    ORDER BY last_assigned_at NULLS FIRST, phone
    LIMIT 1
    FOR UPDATE SKIP LOCKED;
  END IF;

  IF v_phone IS NULL THEN
    RAISE EXCEPTION 'No demo accounts available';
  END IF;

  UPDATE public.demo_account_pool
  SET last_assigned_at = now()
  WHERE phone = v_phone;

  RETURN v_phone;
END;
$$;

-- =============================================================
-- TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================
-- RLS POLICIES
-- Idempotent: DROP IF EXISTS + CREATE pattern.
-- ============================================================

-- ---------- profiles ----------
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Servants can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Servants can insert profiles" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can insert profiles" ON public.profiles
  FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update profiles" ON public.profiles
  FOR UPDATE USING (public.is_admin());

-- ---------- trips ----------
DROP POLICY IF EXISTS "Authenticated users can view trips" ON public.trips;
DROP POLICY IF EXISTS "Admins can manage trips" ON public.trips;
DROP POLICY IF EXISTS "Servants can manage trips" ON public.trips;

CREATE POLICY "Authenticated users can view trips" ON public.trips
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage trips" ON public.trips
  FOR ALL USING (public.is_admin());

-- ---------- buses ----------
DROP POLICY IF EXISTS "Authenticated users can view buses" ON public.buses;
DROP POLICY IF EXISTS "Admins can manage buses" ON public.buses;
DROP POLICY IF EXISTS "Servants can manage buses" ON public.buses;

CREATE POLICY "Authenticated users can view buses" ON public.buses
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage buses" ON public.buses
  FOR ALL USING (public.is_admin());

-- ---------- rooms ----------
DROP POLICY IF EXISTS "Authenticated users can view rooms" ON public.rooms;
DROP POLICY IF EXISTS "Admins can manage rooms" ON public.rooms;
DROP POLICY IF EXISTS "Servants can manage rooms" ON public.rooms;

CREATE POLICY "Authenticated users can view rooms" ON public.rooms
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage rooms" ON public.rooms
  FOR ALL USING (public.is_admin());

-- ---------- bookings ----------
DROP POLICY IF EXISTS "Users can view own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admins can view all bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can create own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admins can manage all bookings" ON public.bookings;
DROP POLICY IF EXISTS "Servants can view all bookings" ON public.bookings;
DROP POLICY IF EXISTS "Servants can manage all bookings" ON public.bookings;

CREATE POLICY "Users can view own bookings" ON public.bookings
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all bookings" ON public.bookings
  FOR SELECT USING (public.is_admin());
CREATE POLICY "Users can create own bookings" ON public.bookings
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.trips WHERE id = trip_id AND is_open = true)
  );
CREATE POLICY "Admins can manage all bookings" ON public.bookings
  FOR ALL USING (public.is_admin());

-- ---------- areas ----------
DROP POLICY IF EXISTS "Authenticated users can read areas" ON public.areas;
DROP POLICY IF EXISTS "Admins can manage areas" ON public.areas;
DROP POLICY IF EXISTS "Servants can manage areas" ON public.areas;

CREATE POLICY "Authenticated users can read areas" ON public.areas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage areas" ON public.areas
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------- admin_logs ----------
DROP POLICY IF EXISTS "Admins can insert logs" ON public.admin_logs;
DROP POLICY IF EXISTS "Admins can view logs" ON public.admin_logs;

CREATE POLICY "Admins can insert logs" ON public.admin_logs
  FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can view logs" ON public.admin_logs
  FOR SELECT USING (public.is_admin());

-- ---------- sectors ----------
DROP POLICY IF EXISTS "Authenticated users can read sectors" ON public.sectors;
DROP POLICY IF EXISTS "Admins can manage sectors" ON public.sectors;

CREATE POLICY "Authenticated users can read sectors"
  ON public.sectors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage sectors"
  ON public.sectors FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------- cars ----------
DROP POLICY IF EXISTS "Authenticated users can read cars" ON public.cars;
DROP POLICY IF EXISTS "Admins can manage cars" ON public.cars;

CREATE POLICY "Authenticated users can read cars"
  ON public.cars FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage cars"
  ON public.cars FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------- family_members ----------
DROP POLICY IF EXISTS "Users can view own family" ON public.family_members;
DROP POLICY IF EXISTS "Admins can view all family" ON public.family_members;
DROP POLICY IF EXISTS "Users can insert own family" ON public.family_members;
DROP POLICY IF EXISTS "Admins can insert family" ON public.family_members;
DROP POLICY IF EXISTS "Users can update own family" ON public.family_members;
DROP POLICY IF EXISTS "Admins can update family" ON public.family_members;
DROP POLICY IF EXISTS "Users can delete own family" ON public.family_members;
DROP POLICY IF EXISTS "Admins can delete family" ON public.family_members;

CREATE POLICY "Users can view own family" ON public.family_members
  FOR SELECT USING (auth.uid() = head_user_id);
CREATE POLICY "Admins can view all family" ON public.family_members
  FOR SELECT USING (public.is_admin());
CREATE POLICY "Users can insert own family" ON public.family_members
  FOR INSERT WITH CHECK (auth.uid() = head_user_id);
CREATE POLICY "Admins can insert family" ON public.family_members
  FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Users can update own family" ON public.family_members
  FOR UPDATE USING (auth.uid() = head_user_id);
CREATE POLICY "Admins can update family" ON public.family_members
  FOR UPDATE USING (public.is_admin());
CREATE POLICY "Users can delete own family" ON public.family_members
  FOR DELETE USING (auth.uid() = head_user_id);
CREATE POLICY "Admins can delete family" ON public.family_members
  FOR DELETE USING (public.is_admin());

-- ---------- demo_account_pool ----------
-- Intentionally no policies: RLS enabled with no grants means direct table
-- access from anon/authenticated is blocked. Access only via claim_demo_account().

-- =============================================================
-- GRANTS
-- ============================================================

-- claim_demo_account is the only function with an explicit grant in the
-- original migrations (the rest rely on Supabase's default EXECUTE grants
-- to anon/authenticated for functions in the public schema).
GRANT EXECUTE ON FUNCTION public.claim_demo_account() TO anon, authenticated;

-- =============================================================
-- SEED DATA
-- ============================================================

-- The 16 canonical sectors (from 00004). Idempotent — skips existing codes.
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

COMMIT;

-- =============================================================
-- End of consolidated schema
-- =============================================================
