-- 1. Create areas table
CREATE TABLE public.areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar text NOT NULL,
  name_en text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(name_ar, name_en)
);

-- 2. Enable RLS
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;

-- 3. RLS policies
CREATE POLICY "Authenticated users can read areas"
  ON public.areas FOR SELECT TO authenticated USING (true);

CREATE POLICY "Servants can manage areas"
  ON public.areas FOR ALL TO authenticated
  USING (is_servant()) WITH CHECK (is_servant());

-- 4. Add columns to buses
ALTER TABLE public.buses ADD COLUMN area_id uuid REFERENCES public.areas(id) ON DELETE SET NULL;
ALTER TABLE public.buses ADD COLUMN bus_label text;

-- 5. Unique index for bus_label per trip
CREATE UNIQUE INDEX idx_buses_unique_label_per_trip
  ON public.buses(trip_id, bus_label) WHERE bus_label IS NOT NULL;

-- 6. Data migration — create areas from existing distinct bus area names, then link buses
INSERT INTO public.areas (name_ar, name_en)
SELECT DISTINCT b.area_name_ar, b.area_name_en
FROM public.buses b
ON CONFLICT (name_ar, name_en) DO NOTHING;

UPDATE public.buses b
SET area_id = a.id
FROM public.areas a
WHERE b.area_name_ar = a.name_ar AND b.area_name_en = a.name_en AND b.area_id IS NULL;
