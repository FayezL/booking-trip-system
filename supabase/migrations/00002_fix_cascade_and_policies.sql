-- Fix migration: Run this in Supabase SQL Editor
-- This patches the live database without losing data

-- 1. Fix bookings → trips FK (THIS FIXES THE TRIP DELETION BUG)
ALTER TABLE public.bookings
  DROP CONSTRAINT bookings_trip_id_fkey,
  ADD CONSTRAINT bookings_trip_id_fkey
  FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE;

-- 2. Fix bookings → buses FK
ALTER TABLE public.bookings
  DROP CONSTRAINT bookings_bus_id_fkey,
  ADD CONSTRAINT bookings_bus_id_fkey
  FOREIGN KEY (bus_id) REFERENCES public.buses(id) ON DELETE CASCADE;

-- 3. Fix bookings → rooms FK
ALTER TABLE public.bookings
  DROP CONSTRAINT bookings_room_id_fkey,
  ADD CONSTRAINT bookings_room_id_fkey
  FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE SET NULL;

-- 4. Fix buses → trips FK
ALTER TABLE public.buses
  DROP CONSTRAINT buses_trip_id_fkey,
  ADD CONSTRAINT buses_trip_id_fkey
  FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE;

-- 5. Fix rooms → trips FK
ALTER TABLE public.rooms
  DROP CONSTRAINT rooms_trip_id_fkey,
  ADD CONSTRAINT rooms_trip_id_fkey
  FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE;

-- 6. Fix profiles → auth.users FK
ALTER TABLE public.profiles
  DROP CONSTRAINT profiles_id_fkey,
  ADD CONSTRAINT profiles_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 7. Add missing UNIQUE constraint on areas
ALTER TABLE public.areas
  DROP CONSTRAINT IF EXISTS areas_name_ar_name_en_key,
  ADD CONSTRAINT areas_name_ar_name_en_key UNIQUE (name_ar, name_en);

-- 8. Replace is_servant() with is_admin() — fix the broken servant check
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

-- 9. Re-create RLS policies using is_admin() instead of is_servant()
DROP POLICY IF EXISTS "Servants can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Servants can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Servants can manage trips" ON public.trips;
DROP POLICY IF EXISTS "Servants can manage buses" ON public.buses;
DROP POLICY IF EXISTS "Servants can manage rooms" ON public.rooms;
DROP POLICY IF EXISTS "Servants can view all bookings" ON public.bookings;
DROP POLICY IF EXISTS "Servants can manage all bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can read areas" ON public.areas;
DROP POLICY IF EXISTS "Servants can manage areas" ON public.areas;
DROP POLICY IF EXISTS "Admins can manage areas" ON public.areas;
DROP POLICY IF EXISTS "Admins can insert logs" ON public.admin_logs;
DROP POLICY IF EXISTS "Admins can view logs" ON public.admin_logs;

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can insert profiles" ON public.profiles
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update profiles" ON public.profiles
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admins can manage trips" ON public.trips
  FOR ALL USING (public.is_admin());

CREATE POLICY "Admins can manage buses" ON public.buses
  FOR ALL USING (public.is_admin());

CREATE POLICY "Admins can manage rooms" ON public.rooms
  FOR ALL USING (public.is_admin());

CREATE POLICY "Admins can view all bookings" ON public.bookings
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can manage all bookings" ON public.bookings
  FOR ALL USING (public.is_admin());

CREATE POLICY "Authenticated users can read areas" ON public.areas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage areas" ON public.areas
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can insert logs" ON public.admin_logs
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can view logs" ON public.admin_logs
  FOR SELECT USING (public.is_admin());

-- 10. Drop old is_servant() if it exists
DROP FUNCTION IF EXISTS public.is_servant();

-- 11. Add move_passenger_bus RPC
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
