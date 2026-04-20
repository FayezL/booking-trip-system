-- 00004_part2: Create new/updated RPC functions
-- RUN THIS AFTER part1 succeeds

-- ============================================================
-- 1. handle_new_user() — add sector_id
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
-- 2. get_sectors()
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
-- 3. update_own_sector()
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
-- 4. register_and_book() — with p_sector_id
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
-- 5. admin_create_user() — with p_sector_id
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
-- 6. get_trip_passengers() — with sector_name + gender
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
