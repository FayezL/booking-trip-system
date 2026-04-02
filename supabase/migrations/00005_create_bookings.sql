CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  trip_id uuid NOT NULL REFERENCES public.trips(id),
  bus_id uuid NOT NULL REFERENCES public.buses(id),
  room_id uuid REFERENCES public.rooms(id),
  created_at timestamptz DEFAULT now(),
  cancelled_at timestamptz,

  CONSTRAINT unique_active_booking UNIQUE (user_id, trip_id) WHERE cancelled_at IS NULL
);

CREATE INDEX idx_bookings_trip_id ON public.bookings(trip_id);
CREATE INDEX idx_bookings_bus_id ON public.bookings(bus_id);
CREATE INDEX idx_bookings_room_id ON public.bookings(room_id);
CREATE INDEX idx_bookings_user_id ON public.bookings(user_id);
