-- 00006: Cars feature — Part 1: Schema changes
-- Run AFTER 00005_part1 and 00005_part2

-- ============================================================
-- 1. Add has_car + car_seats to profiles (idempotent)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'has_car'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN has_car boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'car_seats'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN car_seats int;
    ALTER TABLE public.profiles ADD CONSTRAINT chk_car_seats CHECK (car_seats IS NULL OR car_seats > 0);
  END IF;
END;
$$;

-- ============================================================
-- 2. Create cars table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  capacity int NOT NULL CHECK (capacity > 0),
  car_label text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cars_trip ON public.cars(trip_id);
CREATE INDEX IF NOT EXISTS idx_cars_driver ON public.cars(driver_id) WHERE driver_id IS NOT NULL;

-- ============================================================
-- 3. Make bookings.bus_id nullable + add car_id
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'bus_id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.bookings ALTER COLUMN bus_id DROP NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'car_id'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN car_id uuid REFERENCES public.cars(id) ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_bookings_car_id ON public.bookings(car_id) WHERE car_id IS NOT NULL;

-- ============================================================
-- 4. RLS on cars
-- ============================================================
ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read cars" ON public.cars;
DROP POLICY IF EXISTS "Admins can manage cars" ON public.cars;

CREATE POLICY "Authenticated users can read cars"
  ON public.cars FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage cars"
  ON public.cars FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
