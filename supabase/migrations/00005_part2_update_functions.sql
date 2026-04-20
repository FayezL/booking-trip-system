-- 00005: Part 2 — Update RPC functions with companion support
-- Run AFTER 00005_part1

-- ============================================================
-- Drop old versions of functions we're replacing
-- ============================================================
DROP FUNCTION IF EXISTS public.book_bus(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.book_bus(uuid, uuid, uuid, int);
DROP FUNCTION IF EXISTS public.move_passenger_bus(uuid, uuid);
DROP FUNCTION IF EXISTS public.register_and_book(text, text, text, text, uuid, uuid, text, boolean, uuid);
DROP FUNCTION IF EXISTS public.register_and_book(text, text, text, text, uuid, uuid, text, boolean, uuid, int);

-- ============================================================
-- 1. book_bus() — accept companion_count, new capacity formula
-- ============================================================
CREATE FUNCTION public.book_bus(
  p_user_id uuid,
  p_trip_id uuid,
  p_bus_id uuid,
  p_companion_count int DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_capacity int;
  v_taken int;
  v_booking_id uuid;
BEGIN
  IF NOT public.is_admin() AND auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'You can only book for yourself';
  END IF;

  IF p_companion_count < 0 THEN
    RAISE EXCEPTION 'Invalid companion count';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.trips WHERE id = p_trip_id AND is_open = true) THEN
    RAISE EXCEPTION 'Trip is not open';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bookings
    WHERE user_id = p_user_id AND trip_id = p_trip_id AND cancelled_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Already booked this trip';
  END IF;

  SELECT capacity INTO v_capacity FROM public.buses WHERE id = p_bus_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bus not found';
  END IF;

  SELECT COALESCE(SUM(1 + companion_count), 0) INTO v_taken
  FROM public.bookings
  WHERE bus_id = p_bus_id AND cancelled_at IS NULL;

  IF v_taken + 1 + p_companion_count > v_capacity THEN
    RAISE EXCEPTION 'Bus is full';
  END IF;

  INSERT INTO public.bookings (user_id, trip_id, bus_id, companion_count)
  VALUES (p_user_id, p_trip_id, p_bus_id, p_companion_count)
  RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END;
$$;

-- ============================================================
-- 2. move_passenger_bus() — new capacity formula
-- ============================================================
CREATE FUNCTION public.move_passenger_bus(
  p_booking_id uuid,
  p_new_bus_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_trip_id uuid;
  v_current_bus_id uuid;
  v_capacity int;
  v_taken int;
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

  SELECT COALESCE(SUM(1 + companion_count), 0) INTO v_taken
  FROM public.bookings
  WHERE bus_id = p_new_bus_id AND cancelled_at IS NULL;

  IF v_taken >= v_capacity THEN
    RAISE EXCEPTION 'Target bus is full';
  END IF;

  UPDATE public.bookings
  SET bus_id = p_new_bus_id, room_id = NULL
  WHERE id = p_booking_id;
END;
$$;

-- ============================================================
-- 3. register_and_book() — with companion_count + sector
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
  p_companion_count int DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  new_user_id uuid;
  v_capacity int;
  v_taken int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin users can register new people';
  END IF;

  IF p_role NOT IN ('patient', 'companion', 'family_assistant', 'admin', 'servant') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  IF p_companion_count < 0 THEN
    RAISE EXCEPTION 'Invalid companion count';
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
    SELECT COALESCE(SUM(1 + companion_count), 0) INTO v_taken FROM public.bookings WHERE bus_id = p_bus_id AND cancelled_at IS NULL;

    IF v_taken + 1 + p_companion_count > v_capacity THEN
      RAISE EXCEPTION 'Bus is full';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.trips WHERE id = p_trip_id AND is_open = true) THEN
      RAISE EXCEPTION 'Trip is not open';
    END IF;

    IF EXISTS (SELECT 1 FROM public.bookings WHERE user_id = new_user_id AND trip_id = p_trip_id AND cancelled_at IS NULL) THEN
      RAISE EXCEPTION 'Already booked this trip';
    END IF;

    INSERT INTO public.bookings (user_id, trip_id, bus_id, companion_count) VALUES (new_user_id, p_trip_id, p_bus_id, p_companion_count);
  END IF;

  RETURN new_user_id;
END;
$$;
