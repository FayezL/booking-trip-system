-- 00009: Family Members Feature
-- Lightweight sub-profiles linked to a head user (no auth account needed)
-- Kids/helpers who can't use phones are managed under the head's account

BEGIN;

-- ============================================================
-- 1. FAMILY MEMBERS TABLE
-- ============================================================

CREATE TABLE public.family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  head_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  gender text NOT NULL CHECK (gender IN ('Male', 'Female')),
  has_wheelchair boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_family_members_head ON public.family_members(head_user_id);

ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

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

-- ============================================================
-- 2. ADD FAMILY_MEMBER_ID TO BOOKINGS
-- ============================================================

ALTER TABLE public.bookings
  ADD COLUMN family_member_id uuid REFERENCES public.family_members(id) ON DELETE CASCADE;

CREATE INDEX idx_bookings_family_member_id ON public.bookings(family_member_id) WHERE family_member_id IS NOT NULL;

-- Drop old unique index, create two partial indexes
DROP INDEX IF EXISTS public.idx_bookings_unique_active;

CREATE UNIQUE INDEX idx_bookings_head_unique
  ON public.bookings(user_id, trip_id)
  WHERE cancelled_at IS NULL AND family_member_id IS NULL;

CREATE UNIQUE INDEX idx_bookings_family_unique
  ON public.bookings(user_id, trip_id, family_member_id)
  WHERE cancelled_at IS NULL AND family_member_id IS NOT NULL;

-- ============================================================
-- 3. NEW RPC: add_family_member
-- ============================================================

CREATE OR REPLACE FUNCTION public.add_family_member(
  p_head_user_id uuid,
  p_full_name text,
  p_gender text,
  p_has_wheelchair boolean DEFAULT false
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

  INSERT INTO public.family_members (head_user_id, full_name, gender, has_wheelchair)
  VALUES (p_head_user_id, p_full_name, p_gender, p_has_wheelchair)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ============================================================
-- 4. NEW RPC: update_family_member
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_family_member(
  p_member_id uuid,
  p_full_name text,
  p_gender text,
  p_has_wheelchair boolean
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

  UPDATE public.family_members
  SET full_name = p_full_name, gender = p_gender, has_wheelchair = p_has_wheelchair
  WHERE id = p_member_id;
END;
$$;

-- ============================================================
-- 5. NEW RPC: remove_family_member
-- ============================================================

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

-- ============================================================
-- 6. NEW RPC: get_family_members
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_family_members(p_user_id uuid DEFAULT NULL)
RETURNS TABLE(id uuid, head_user_id uuid, full_name text, gender text, has_wheelchair boolean, created_at timestamptz)
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
    SELECT fm.id, fm.head_user_id, fm.full_name, fm.gender, fm.has_wheelchair, fm.created_at
    FROM public.family_members fm
    WHERE fm.head_user_id = p_user_id
    ORDER BY fm.created_at;
END;
$$;

-- ============================================================
-- 7. NEW RPC: book_bus_with_family
-- Books head + selected family members on the same bus in one transaction
-- ============================================================

CREATE OR REPLACE FUNCTION public.book_bus_with_family(
  p_user_id uuid,
  p_trip_id uuid,
  p_bus_id uuid,
  p_family_member_ids uuid[] DEFAULT '{}'
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

  IF EXISTS (
    SELECT 1 FROM public.bookings
    WHERE user_id = p_user_id AND trip_id = p_trip_id AND family_member_id IS NULL AND cancelled_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Already booked this trip';
  END IF;

  IF array_length(p_family_member_ids, 1) > 0 THEN
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
        RAISE EXCEPTION 'Family member already booked this trip';
      END IF;
    END LOOP;
  END IF;

  SELECT capacity INTO v_capacity FROM public.buses WHERE id = p_bus_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bus not found'; END IF;

  SELECT COUNT(*) INTO v_current FROM public.bookings WHERE bus_id = p_bus_id AND cancelled_at IS NULL;

  v_needed := 1 + COALESCE(array_length(p_family_member_ids, 1), 0);
  IF v_current + v_needed > v_capacity THEN
    RAISE EXCEPTION 'Bus is full — need % seats but only % available', v_needed, v_capacity - v_current;
  END IF;

  INSERT INTO public.bookings (user_id, trip_id, bus_id)
  VALUES (p_user_id, p_trip_id, p_bus_id)
  RETURNING id INTO v_booking_id;

  IF array_length(p_family_member_ids, 1) > 0 THEN
    FOR v_fm_id IN SELECT unnest(p_family_member_ids) LOOP
      INSERT INTO public.bookings (user_id, trip_id, bus_id, family_member_id)
      VALUES (p_user_id, p_trip_id, p_bus_id, v_fm_id);
    END LOOP;
  END IF;

  RETURN v_booking_id;
END;
$$;

-- ============================================================
-- 8. UPDATED RPC: get_trip_passengers
-- Now includes family member details + head_user_id for grouping
-- ============================================================

DROP FUNCTION IF EXISTS public.get_trip_passengers(uuid);

CREATE OR REPLACE FUNCTION public.get_trip_passengers(p_trip_id uuid)
RETURNS TABLE(
  bus_id uuid,
  full_name text,
  has_wheelchair boolean,
  gender text,
  sector_name text,
  family_member_id uuid,
  head_user_id uuid
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
      b.user_id AS head_user_id
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

-- ============================================================
-- 9. UPDATED RPC: cancel_booking
-- When head cancels, also cancels all family member bookings for that trip
-- ============================================================

DROP FUNCTION IF EXISTS public.cancel_booking(uuid);

CREATE OR REPLACE FUNCTION public.cancel_booking(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_car_id uuid;
  v_fm_id uuid;
  v_trip_id uuid;
BEGIN
  SELECT user_id, car_id, family_member_id, trip_id
  INTO v_user_id, v_car_id, v_fm_id, v_trip_id
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

  IF v_fm_id IS NULL THEN
    UPDATE public.bookings
    SET cancelled_at = now(), room_id = NULL
    WHERE user_id = v_user_id
      AND trip_id = v_trip_id
      AND family_member_id IS NOT NULL
      AND cancelled_at IS NULL;
  END IF;

  IF v_car_id IS NOT NULL THEN
    DELETE FROM public.cars WHERE id = v_car_id;
  END IF;
END;
$$;

-- ============================================================
-- 10. UPDATED RPC: assign_room
-- Uses family member gender when applicable
-- ============================================================

DROP FUNCTION IF EXISTS public.assign_room(uuid, uuid);

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

-- ============================================================
-- 11. UPDATED RPC: book_bus
-- Fix duplicate check to only look at head bookings
-- ============================================================

DROP FUNCTION IF EXISTS public.book_bus(uuid, uuid, uuid);

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
BEGIN
  IF NOT public.is_admin() AND auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'You can only book for yourself';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.trips WHERE id = p_trip_id AND is_open = true) THEN
    RAISE EXCEPTION 'Trip is not open';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bookings
    WHERE user_id = p_user_id AND trip_id = p_trip_id
      AND family_member_id IS NULL AND cancelled_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Already booked this trip';
  END IF;

  SELECT capacity INTO v_capacity FROM public.buses WHERE id = p_bus_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bus not found'; END IF;

  SELECT COUNT(*) INTO v_current
  FROM public.bookings WHERE bus_id = p_bus_id AND cancelled_at IS NULL;

  IF v_current >= v_capacity THEN
    RAISE EXCEPTION 'Bus is full';
  END IF;

  INSERT INTO public.bookings (user_id, trip_id, bus_id)
  VALUES (p_user_id, p_trip_id, p_bus_id)
  RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END;
$$;

COMMIT;
