CREATE TABLE public.buses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  area_name_ar text NOT NULL,
  area_name_en text NOT NULL,
  capacity int NOT NULL CHECK (capacity > 0),
  leader_name text
);
