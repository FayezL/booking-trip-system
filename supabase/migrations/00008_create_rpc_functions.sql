-- RPC: Register new patient and optionally book them into a bus
-- Used by servants to register + book in one transaction
CREATE OR REPLACE FUNCTION public.register_and_book(
  p_phone text,
  p_full_name text,
  p_gender text,
  p_password text,
  p_trip_id uuid DEFAULT NULL,
  p_bus_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_user_id uuid;
  new_booking_id uuid;
  bus_capacity int;
  current_bookings int;
BEGIN
  -- Create auth user
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_user_meta_data
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    p_phone || '@church.local',
    crypt(p_password, gen_salt('bf')),
    now(),
    now(),
    now(),
    jsonb_build_object('full_name', p_full_name, 'gender', p_gender, 'role', 'patient')
  ) RETURNING id INTO new_user_id;

  -- Profile is auto-created by the trigger

  -- Optionally book into bus
  IF p_trip_id IS NOT NULL AND p_bus_id IS NOT NULL THEN
    -- Lock bus row and check capacity
    SELECT capacity INTO bus_capacity FROM public.buses WHERE id = p_bus_id FOR UPDATE;

    SELECT COUNT(*) INTO current_bookings
    FROM public.bookings
    WHERE bus_id = p_bus_id AND cancelled_at IS NULL;

    IF current_bookings >= bus_capacity THEN
      RAISE EXCEPTION 'Bus is full';
    END IF;

    -- Check trip is open
    IF NOT EXISTS (SELECT 1 FROM public.trips WHERE id = p_trip_id AND is_open = true) THEN
      RAISE EXCEPTION 'Trip is not open';
    END IF;

    -- Check no existing active booking
    IF EXISTS (
      SELECT 1 FROM public.bookings
      WHERE user_id = new_user_id AND trip_id = p_trip_id AND cancelled_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Already booked this trip';
    END IF;

    INSERT INTO public.bookings (user_id, trip_id, bus_id)
    VALUES (new_user_id, p_trip_id, p_bus_id)
    RETURNING id INTO new_booking_id;
  END IF;

  RETURN new_user_id;
END;
$$;

-- RPC: Assign room to a booking with gender validation
CREATE OR REPLACE FUNCTION public.assign_room(
  p_booking_id uuid,
  p_room_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_gender text;
  v_room_type text;
  v_room_capacity int;
  v_current_occupants int;
BEGIN
  -- Get booking user's gender
  SELECT p.gender INTO v_gender
  FROM public.bookings b
  JOIN public.profiles p ON p.id = b.user_id
  WHERE b.id = p_booking_id AND b.cancelled_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found or cancelled';
  END IF;

  -- Lock room row and get details
  SELECT room_type, capacity INTO v_room_type, v_room_capacity
  FROM public.rooms WHERE id = p_room_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  -- Validate gender match
  IF v_gender != v_room_type THEN
    RAISE EXCEPTION 'Gender mismatch: user is % but room is %', v_gender, v_room_type;
  END IF;

  -- Check capacity
  SELECT COUNT(*) INTO v_current_occupants
  FROM public.bookings
  WHERE room_id = p_room_id AND cancelled_at IS NULL;

  IF v_current_occupants >= v_room_capacity THEN
    RAISE EXCEPTION 'Room is full';
  END IF;

  -- Assign room
  UPDATE public.bookings SET room_id = p_room_id WHERE id = p_booking_id;
END;
$$;

-- RPC: Cancel a booking (soft delete)
CREATE OR REPLACE FUNCTION public.cancel_booking(
  p_booking_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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
