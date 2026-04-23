-- ============================================================
-- Migration: Trip-Only Booking + Advanced Dashboard
-- ============================================================

-- 1. NEW RPC: book_trip_only_with_family
-- Books head + selected family members on a trip without choosing a bus
CREATE OR REPLACE FUNCTION public.book_trip_only_with_family(
  p_user_id uuid,
  p_trip_id uuid,
  p_family_member_ids uuid[] DEFAULT '{}'
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

  INSERT INTO public.bookings (user_id, trip_id, bus_id, car_id)
  VALUES (p_user_id, p_trip_id, NULL, NULL)
  RETURNING id INTO v_booking_id;

  IF array_length(p_family_member_ids, 1) > 0 THEN
    FOR v_fm_id IN SELECT unnest(p_family_member_ids) LOOP
      INSERT INTO public.bookings (user_id, trip_id, bus_id, car_id, family_member_id)
      VALUES (p_user_id, p_trip_id, NULL, NULL, v_fm_id);
    END LOOP;
  END IF;

  RETURN v_booking_id;
END;
$$;

-- 2. NEW RPC: get_all_trips_stats
-- Returns aggregated stats for all trips (admin only)
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
          (SELECT jsonb_object_agg(role, cnt) FROM (
            SELECT p.role, COUNT(*) AS cnt
            FROM public.bookings b
            JOIN public.profiles p ON p.id = b.user_id
            WHERE b.trip_id = t.id AND b.cancelled_at IS NULL AND p.deleted_at IS NULL
              AND b.family_member_id IS NULL
            GROUP BY p.role
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
            SELECT p.transport_type, COUNT(*) AS cnt
            FROM public.bookings b
            JOIN public.profiles p ON p.id = b.user_id
            WHERE b.trip_id = t.id AND b.cancelled_at IS NULL AND p.deleted_at IS NULL
              AND b.family_member_id IS NULL
            GROUP BY p.transport_type
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
           WHERE b.trip_id = t.id AND b.cancelled_at IS NULL AND b.family_member_id IS NOT NULL),
          0
        ) AS family_members_count,

        COALESCE(
          (SELECT jsonb_agg(jsonb_build_object('name', sector_name, 'count', cnt)) FROM (
            SELECT COALESCE(s.name, 'Unassigned') AS sector_name, COUNT(*) AS cnt
            FROM public.bookings b
            JOIN public.profiles p ON p.id = b.user_id
            LEFT JOIN public.sectors s ON s.id = p.sector_id
            WHERE b.trip_id = t.id AND b.cancelled_at IS NULL AND p.deleted_at IS NULL
              AND b.family_member_id IS NULL
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
            '0', COALESCE(SUM(CASE WHEN p.servants_needed = 0 THEN 1 ELSE 0 END), 0),
            '1', COALESCE(SUM(CASE WHEN p.servants_needed = 1 THEN 1 ELSE 0 END), 0),
            '2', COALESCE(SUM(CASE WHEN p.servants_needed = 2 THEN 1 ELSE 0 END), 0)
          )
          FROM public.bookings b
          JOIN public.profiles p ON p.id = b.user_id
          WHERE b.trip_id = t.id AND b.cancelled_at IS NULL AND p.deleted_at IS NULL
            AND b.family_member_id IS NULL),
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
  ) sub
  ORDER BY sub.trip_date DESC;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- 3. PERFORMANCE: Partial index for active bookings per trip
-- Covers the most common query pattern: WHERE trip_id = X AND cancelled_at IS NULL
CREATE INDEX IF NOT EXISTS idx_bookings_trip_active
  ON public.bookings(trip_id)
  WHERE cancelled_at IS NULL;
