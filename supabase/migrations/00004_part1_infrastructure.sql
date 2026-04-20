-- 00004_part1: Drop old functions + create sectors infrastructure
-- RUN THIS FIRST in Supabase SQL Editor

-- ============================================================
-- 1. Drop ALL old versions of functions we're replacing
-- ============================================================
DROP FUNCTION IF EXISTS public.register_and_book(text, text, text, text, uuid, uuid, text, boolean);
DROP FUNCTION IF EXISTS public.register_and_book(text, text, text, text, uuid, uuid, text, boolean, uuid);
DROP FUNCTION IF EXISTS public.admin_create_user(text, text, text, text, text, boolean);
DROP FUNCTION IF EXISTS public.admin_create_user(text, text, text, text, text, boolean, uuid);
DROP FUNCTION IF EXISTS public.get_trip_passengers(uuid);

-- ============================================================
-- 2. Create sectors table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sectors_active ON public.sectors(is_active) WHERE is_active = true;

-- ============================================================
-- 3. Seed the 16 sectors (idempotent)
-- ============================================================
INSERT INTO public.sectors (name, code, sort_order)
SELECT v.name, v.code, v.sort_order
FROM (VALUES
  ('ابونا بيشوى كامل', '01', 1),
  ('ابونا فلتاؤوس', '02', 2),
  ('اغابى', '03', 3),
  ('استقبال', '04', 4),
  ('داون', '05', 5),
  ('مسنين', '06', 6),
  ('علاج طبيعى', '07', 7),
  ('فيصل - حركى', '08', 8),
  ('ترسا - حركى', '09', 9),
  ('مارمينا طالبية - حركى', '10', 10),
  ('مارمرقس طالبية - حركى', '11', 11),
  ('خدمه مدارس احد', '12', 12),
  ('خدمه ترانيم', '13', 13),
  ('اسره المحبه', '14', 14),
  ('عام', '15', 15),
  ('تدريب', '16', 16)
) AS v(name, code, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.sectors WHERE code = v.code);

-- ============================================================
-- 4. Add sector_id to profiles (idempotent)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'sector_id'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN sector_id uuid REFERENCES public.sectors(id) ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_profiles_sector ON public.profiles(sector_id) WHERE sector_id IS NOT NULL;

-- ============================================================
-- 5. RLS on sectors
-- ============================================================
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read sectors" ON public.sectors;
DROP POLICY IF EXISTS "Admins can manage sectors" ON public.sectors;

CREATE POLICY "Authenticated users can read sectors"
  ON public.sectors FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage sectors"
  ON public.sectors FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
