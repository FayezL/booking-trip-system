-- 00003: Add all RPC functions to the live database
-- Run this in Supabase SQL Editor
-- These functions are needed by the frontend but were lost when old migrations were cleaned up

-- 1. Ensure auth trigger exists
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, phone, full_name, gender, role, has_wheelchair)
  VALUES (
    NEW.id,
    split_part(NEW.email, '@', 1),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'gender', 'Male'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'patient'),
    COALESCE((NEW.raw_user_meta_data->>'has_wheelchair')::boolean, false)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. register_and_book — used by UnbookedTab + signup
CREATE OR REPLACE FUNCTION public.register_and_book(
  p_phone text,
  p_full_name text,
  p_gender text,
  p_password text,
  p_trip_id uuid DEFAULT NULL,
  p_bus_id uuid DEFAULT NULL,
  p_role text DEFAULT 'patient',
  p_has_wheelchair boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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
      'has_wheelchair', p_has_wheelchair
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

-- 3. book_bus — used by patient bus page + UnbookedTab
CREATE OR REPLACE FUNCTION public.book_bus(
  p_user_id uuid,
  p_trip_id uuid,
  p_bus_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_capacity int;
  v_current int;
  v_booking_id uuid;
BEGIN
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

  SELECT COUNT(*) INTO v_current
  FROM public.bookings
  WHERE bus_id = p_bus_id AND cancelled_at IS NULL;

  IF v_current >= v_capacity THEN
    RAISE EXCEPTION 'Bus is full';
  END IF;

  INSERT INTO public.bookings (user_id, trip_id, bus_id)
  VALUES (p_user_id, p_trip_id, p_bus_id)
  RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END;
$$;

-- 4. assign_room — used by RoomsTab
CREATE OR REPLACE FUNCTION public.assign_room(
  p_booking_id uuid,
  p_room_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_gender text;
  v_room_type text;
  v_room_capacity int;
  v_current_occupants int;
BEGIN
  SELECT p.gender INTO v_gender
  FROM public.bookings b
  JOIN public.profiles p ON p.id = b.user_id
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

-- 5. cancel_booking — used by trips page + BusesTab
CREATE OR REPLACE FUNCTION public.cancel_booking(
  p_booking_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.bookings
  SET cancelled_at = now(), room_id = NULL
  WHERE id = p_booking_id AND cancelled_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found or already cancelled';
  END IF;
END;
$$;

-- 6. get_trip_passengers — used by patient trips page + buses page
CREATE OR REPLACE FUNCTION public.get_trip_passengers(p_trip_id uuid)
RETURNS TABLE(bus_id uuid, full_name text, has_wheelchair boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
    SELECT b.bus_id, p.full_name, p.has_wheelchair
    FROM public.bookings b
    JOIN public.profiles p ON p.id = b.user_id
    WHERE b.trip_id = p_trip_id
      AND b.cancelled_at IS NULL
      AND p.deleted_at IS NULL
    ORDER BY p.full_name;
END;
$$;

-- 7. admin_create_user — used by Users page
CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_phone text,
  p_full_name text,
  p_gender text,
  p_password text,
  p_role text,
  p_has_wheelchair boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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
      'has_wheelchair', p_has_wheelchair
    )
  ) RETURNING id INTO new_user_id;

  RETURN new_user_id;
END;
$$;

-- 8. admin_delete_user — used by Users page
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

  UPDATE public.profiles SET deleted_at = now() WHERE id = p_user_id;
END;
$$;

-- 9. admin_reset_password — used by Users page
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

-- 10. move_passenger_bus — used by BusesTab (new feature)
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

-- 11. Add missing indexes (safe to run, will skip if exists)
CREATE INDEX IF NOT EXISTS idx_bookings_trip_id ON public.bookings(trip_id);
CREATE INDEX IF NOT EXISTS idx_bookings_bus_id ON public.bookings(bus_id);
CREATE INDEX IF NOT EXISTS idx_bookings_room_id ON public.bookings(room_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON public.admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON public.admin_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON public.admin_logs(action);
