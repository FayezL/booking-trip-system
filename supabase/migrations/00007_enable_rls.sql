ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Profiles: servants can view all profiles
CREATE POLICY "Servants can view all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'servant')
  );

-- Trips: anyone authenticated can view
CREATE POLICY "Authenticated users can view trips" ON public.trips
  FOR SELECT USING (auth.role() = 'authenticated');

-- Trips: servants can manage
CREATE POLICY "Servants can manage trips" ON public.trips
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'servant')
  );

-- Buses: anyone authenticated can view
CREATE POLICY "Authenticated users can view buses" ON public.buses
  FOR SELECT USING (auth.role() = 'authenticated');

-- Buses: servants can manage
CREATE POLICY "Servants can manage buses" ON public.buses
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'servant')
  );

-- Rooms: anyone authenticated can view
CREATE POLICY "Authenticated users can view rooms" ON public.rooms
  FOR SELECT USING (auth.role() = 'authenticated');

-- Rooms: servants can manage
CREATE POLICY "Servants can manage rooms" ON public.rooms
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'servant')
  );

-- Bookings: users can view own bookings
CREATE POLICY "Users can view own bookings" ON public.bookings
  FOR SELECT USING (auth.uid() = user_id);

-- Bookings: servants can view all bookings
CREATE POLICY "Servants can view all bookings" ON public.bookings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'servant')
  );

-- Bookings: users can create own bookings (if trip is open)
CREATE POLICY "Users can create own bookings" ON public.bookings
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.trips WHERE id = trip_id AND is_open = true)
  );

-- Bookings: servants can manage all bookings
CREATE POLICY "Servants can manage all bookings" ON public.bookings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'servant')
  );
