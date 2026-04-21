-- 00009: User profile enhancements
-- Adds: transport_type, servants_needed, trainee role
-- New RPCs: update_own_name, update_own_phone, update_own_transport, update_own_password, admin_get_user_details
-- Updated RPCs: handle_new_user, register_and_book, admin_create_user

BEGIN;

-- ============================================================
-- 1. Add new columns to profiles (idempotent)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'transport_type'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN transport_type text NOT NULL DEFAULT 'bus';
    ALTER TABLE public.profiles ADD CONSTRAINT chk_transport_type CHECK (transport_type IN ('private', 'bus'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'servants_needed'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN servants_needed int NOT NULL DEFAULT 0;
    ALTER TABLE public.profiles ADD CONSTRAINT chk_servants_needed CHECK (servants_needed IN (0, 1, 2));
  END IF;
END;
$$;

-- ============================================================
-- 2. Add 'trainee' to role CHECK constraint
-- ============================================================
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE rel.relname = 'profiles'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) LIKE '%super_admin%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', constraint_name);
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
      CHECK (role IN ('super_admin', 'admin', 'servant', 'patient', 'companion', 'family_assistant', 'trainee'));
  END IF;
END;
$$;

-- ============================================================
-- 3. Update handle_new_user() — extract transport_type + servants_needed
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, phone, full_name, gender, role, has_wheelchair, sector_id, transport_type, servants_needed)
  VALUES (
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
  RETURN NEW;
END;
$$;

-- ============================================================
-- 4. Drop old function signatures before recreating
-- ============================================================
DROP FUNCTION IF EXISTS public.register_and_book(text, text, text, text, uuid, uuid, text, boolean);
DROP FUNCTION IF EXISTS public.register_and_book(text, text, text, text, uuid, uuid, text, boolean, uuid);
DROP FUNCTION IF EXISTS public.admin_create_user(text, text, text, text, text, boolean);
DROP FUNCTION IF EXISTS public.admin_create_user(text, text, text, text, text, boolean, uuid);

-- ============================================================
-- 5. register_and_book() — with transport_type + servants_needed + trainee
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

-- ============================================================
-- 6. admin_create_user() — with transport_type + servants_needed + trainee
-- ============================================================
CREATE FUNCTION public.admin_create_user(
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

-- ============================================================
-- 7. update_own_name()
-- ============================================================
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
END;
$$;

-- ============================================================
-- 8. update_own_phone() — atomically updates profile + auth email
-- ============================================================
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

-- ============================================================
-- 9. update_own_transport()
-- ============================================================
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
END;
$$;

-- ============================================================
-- 10. update_own_password()
-- ============================================================
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

-- ============================================================
-- 11. admin_get_user_details() — full profile for admin modal
-- ============================================================
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

COMMIT;
