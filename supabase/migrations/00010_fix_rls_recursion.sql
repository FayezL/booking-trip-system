CREATE OR REPLACE FUNCTION public.is_servant()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'servant');
$$;

DROP POLICY IF EXISTS "Servants can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Servants can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Servants can manage trips" ON public.trips;
DROP POLICY IF EXISTS "Servants can manage buses" ON public.buses;
DROP POLICY IF EXISTS "Servants can manage rooms" ON public.rooms;
DROP POLICY IF EXISTS "Servants can view all bookings" ON public.bookings;
DROP POLICY IF EXISTS "Servants can manage all bookings" ON public.bookings;

CREATE POLICY "Servants can view all profiles" ON public.profiles
  FOR SELECT USING (public.is_servant());

CREATE POLICY "Servants can insert profiles" ON public.profiles
  FOR INSERT WITH CHECK (public.is_servant());

CREATE POLICY "Servants can manage trips" ON public.trips
  FOR ALL USING (public.is_servant());

CREATE POLICY "Servants can manage buses" ON public.buses
  FOR ALL USING (public.is_servant());

CREATE POLICY "Servants can manage rooms" ON public.rooms
  FOR ALL USING (public.is_servant());

CREATE POLICY "Servants can view all bookings" ON public.bookings
  FOR SELECT USING (public.is_servant());

CREATE POLICY "Servants can manage all bookings" ON public.bookings
  FOR ALL USING (public.is_servant());
