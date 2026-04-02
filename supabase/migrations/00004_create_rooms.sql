CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  room_type text NOT NULL CHECK (room_type IN ('Male', 'Female')),
  capacity int NOT NULL CHECK (capacity > 0),
  supervisor_name text,
  room_label text NOT NULL
);
