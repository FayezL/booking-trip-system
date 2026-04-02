CREATE TABLE public.trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_ar text NOT NULL,
  title_en text NOT NULL,
  trip_date date NOT NULL,
  is_open boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
