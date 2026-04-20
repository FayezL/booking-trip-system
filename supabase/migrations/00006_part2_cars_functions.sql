-- 00006: Cars feature — Part 2: RPC functions
-- Run AFTER 00006_part1

-- ============================================================
-- Drop old versions + new car RPCs
-- ============================================================
DROP FUNCTION IF EXISTS public.update_own_car_settings(boolean, int);
DROP FUNCTION IF EXISTS public.admin_update_car_settings(uuid, boolean, int);
DROP FUNCTION IF EXISTS public.book_with_car(uuid);
DROP FUNCTION IF EXISTS public.assign_car_passenger(uuid, uuid);
DROP FUNCTION IF EXISTS public.remove_car(uuid);
DROP FUNCTION IF EXISTS public.admin_create_car(uuid, uuid, int);
DROP FUNCTION IF EXISTS public.cancel_booking(uuid);

-- ============================================================
-- 1. update_own_car_settings — servant self-service
-- ============================================================
CREATE FUNCTION public.update_own_car_settings(
  p_has_car boolean,
  p_car_seats int
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  UPDATE public.profiles
  SET has_car = p_has_car,
      car_seats = CASE WHEN p_has_car THEN p_car_seats ELSE NULL END
  WHERE id = auth.uid();
END;
$$;

-- ============================================================
-- 2. admin_update_car_settings — admin changes any servant's car
-- ============================================================
CREATE FUNCTION public.admin_update_car_settings(
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

-- ============================================================
-- 3. book_with_car — servant auto-creates car + booking
-- ============================================================
CREATE FUNCTION public.book_with_car(
  p_trip_id uuid
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_car_id uuid;
  v_booking_id uuid;
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

  IF EXISTS (
    SELECT 1 FROM public.bookings
    WHERE user_id = auth.uid() AND trip_id = p_trip_id AND cancelled_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Already booked this trip';
  END IF;

  INSERT INTO public.cars (trip_id, driver_id, capacity, car_label)
  VALUES (p_trip_id, auth.uid(), v_profile.car_seats, v_profile.full_name || ' car')
  RETURNING id INTO v_car_id;

  INSERT INTO public.bookings (user_id, trip_id, car_id)
  VALUES (auth.uid(), p_trip_id, v_car_id)
  RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END;
$$;

-- ============================================================
-- 4. assign_car_passenger — admin moves patient to a car
-- ============================================================
CREATE FUNCTION public.assign_car_passenger(
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

-- ============================================================
-- 5. remove_car — admin removes car from trip
-- ============================================================
CREATE FUNCTION public.remove_car(p_car_id uuid)
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

-- ============================================================
-- 6. admin_create_car — admin manually creates car
-- ============================================================
CREATE FUNCTION public.admin_create_car(
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

-- ============================================================
-- 7. cancel_booking — updated to handle car bookings
-- ============================================================
CREATE FUNCTION public.cancel_booking(p_booking_id uuid)
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
