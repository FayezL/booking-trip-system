-- 00005: Add companion_count to bookings + update capacity formulas
-- Run AFTER 00004_part1 and 00004_part2
-- Split into two parts for safety

-- ============================================================
-- PART A: Schema change (run first)
-- ============================================================

-- Add companion_count column (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'companion_count'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN companion_count int NOT NULL DEFAULT 0;
    ALTER TABLE public.bookings ADD CONSTRAINT chk_companion_count CHECK (companion_count >= 0);
  END IF;
END;
$$;
