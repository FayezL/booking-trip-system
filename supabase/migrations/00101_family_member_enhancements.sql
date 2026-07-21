-- ============================================================
-- Migration 00101: Family Member Enhancements
-- Head user treated as a family member (is_head=true)
-- Each person has: role, transport_type, servants_needed,
--   room_floor, room_section, phone
-- Cancel is independent per person (no cascade)
-- Booking is uniform: pass family_member_ids array
-- ============================================================

BEGIN;

-- ============================================================
-- 1. ADD NEW COLUMNS TO family_members
-- ============================================================

ALTER TABLE public.family_members
  ADD COLUMN IF NOT EXISTS is_head boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'patient'
    CHECK (role IN ('patient','servant','companion','family_assistant','trainee')),
  ADD COLUMN IF NOT EXISTS transport_type text NOT NULL DEFAULT 'bus'
    CHECK (transport_type IN ('private','bus')),
  ADD COLUMN IF NOT EXISTS servants_needed int NOT NULL DEFAULT 0
    CHECK (servants_needed IN (0, 1, 2)),
  ADD COLUMN IF NOT EXISTS room_floor text
    CHECK (room_floor IS NULL OR room_floor IN ('ground','upper')),
  ADD COLUMN IF NOT EXISTS room_section text
    CHECK (room_section IS NULL OR room_section IN ('Male','Female','Families'));

-- ============================================================
-- 2. SEED EXISTING USERS AS HEAD MEMBERS
-- Copies trip data from profiles into family_members for every
-- existing non-deleted user so they appear in the uniform list.
-- ============================================================

INSERT INTO public.family_members (
  head_user_id, full_name, gender, has_wheelchair,
  is_head, role, transport_type, servants_needed
)
SELECT
  p.id, p.full_name, p.gender, p.has_wheelchair,
  true, p.role, p.transport_type, p.servants_needed
FROM public.profiles p
WHERE p.deleted_at IS NULL
  AND p.role NOT IN ('super_admin', 'admin')
  AND NOT EXISTS (
    SELECT 1 FROM public.family_members fm
    WHERE fm.head_user_id = p.id AND fm.is_head = true
  );

-- ============================================================
-- 3. NEW RPC: sync_head_member
-- Keeps profiles in sync when head data changes via family API
-- ============================================================

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

-- ============================================================
-- 4. UPDATE handle_new_user TRIGGER
-- Auto-creates head family_member row for non-admin users
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
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

-- ============================================================
-- 5. UPDATED: add_family_member (new signature with all fields)
-- ============================================================

DROP FUNCTION IF EXISTS public.add_family_member(uuid, text, text, boolean);

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

-- ============================================================
-- 6. UPDATED: update_family_member (new signature + head sync)
-- ============================================================

DROP FUNCTION IF EXISTS public.update_family_member(uuid, text, text, boolean);

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

-- ============================================================
-- 7. UPDATED: get_family_members (returns all new fields)
-- ============================================================

DROP FUNCTION IF EXISTS public.get_family_members(uuid);

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

-- ============================================================
-- 8. UPDATED: book_bus_with_family (uniform booking — head is just a member)
-- ============================================================

DROP FUNCTION IF EXISTS public.book_bus_with_family(uuid, uuid, uuid, uuid[]);

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

-- ============================================================
-- 9. UPDATED: book_trip_only_with_family (uniform booking — no bus)
-- ============================================================

DROP FUNCTION IF EXISTS public.book_trip_only_with_family(uuid, uuid, uuid[]);

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

-- ============================================================
-- 10. UPDATED: cancel_booking (independent — no family cascade)
-- ============================================================

DROP FUNCTION IF EXISTS public.cancel_booking(uuid);

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

-- ============================================================
-- 11. UPDATED: get_trip_passengers (returns new fields)
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

-- ============================================================
-- 12. UPDATED: book_bus (head-only — uses head family_member row)
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

-- ============================================================
-- 13. UPDATED: book_with_car (uses head family_member row)
-- ============================================================

DROP FUNCTION IF EXISTS public.book_with_car(uuid);

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

-- ============================================================
-- 14. UPDATED: update_own_name (syncs to head family_member)
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

  UPDATE public.family_members
  SET full_name = trim(p_name)
  WHERE head_user_id = auth.uid() AND is_head = true;
END;
$$;

-- ============================================================
-- 15. UPDATED: update_own_transport (syncs to head family_member)
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

  UPDATE public.family_members
  SET transport_type = p_transport_type,
      servants_needed = p_servants_needed
  WHERE head_user_id = auth.uid() AND is_head = true;
END;
$$;

-- ============================================================
-- 16. UPDATED: get_all_trips_stats (includes family member roles/transport)
-- ============================================================

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

COMMIT;
