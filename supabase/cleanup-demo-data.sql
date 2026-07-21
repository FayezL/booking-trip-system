-- Idempotent teardown of all demo data.
-- RUN ON THE DEMO DATABASE ONLY.
-- Identifies demo rows by: trips.title_en LIKE '[DEMO]%', profiles.phone LIKE '099%'.

BEGIN;

-- Safety: refuse to run if there is nothing to clean.
DO $$
DECLARE
  demo_users int;
  demo_trips int;
BEGIN
  SELECT COUNT(*) INTO demo_users FROM public.profiles WHERE phone LIKE '099%';
  SELECT COUNT(*) INTO demo_trips FROM public.trips WHERE title_en LIKE '[DEMO]%';
  IF demo_users = 0 AND demo_trips = 0 THEN
    RAISE EXCEPTION 'No demo data found. Nothing to clean up.';
  END IF;
END $$;

-- 1. Delete demo trips. Cascades buses, rooms, cars, and bookings on those trips.
DELETE FROM public.trips WHERE title_en LIKE '[DEMO]%';

-- 2. Delete any remaining bookings tied to demo users (defensive; covers
--    bookings on non-demo trips, though the seed never creates any).
DELETE FROM public.bookings
WHERE user_id IN (SELECT id FROM public.profiles WHERE phone LIKE '099%');

-- 3. Delete head family_members for demo users.
DELETE FROM public.family_members
WHERE head_user_id IN (SELECT id FROM public.profiles WHERE phone LIKE '099%');

-- 4. Delete demo profiles.
DELETE FROM public.profiles WHERE phone LIKE '099%';

-- 5. Delete demo auth.users.
DELETE FROM auth.users WHERE email LIKE '099%@church.local';

-- 6. Reset the round-robin pool.
TRUNCATE public.demo_account_pool;

-- Verify.
DO $$
DECLARE remaining int;
BEGIN
  SELECT COUNT(*) INTO remaining FROM public.profiles WHERE phone LIKE '099%';
  IF remaining > 0 THEN
    RAISE EXCEPTION 'Cleanup incomplete: % demo profiles still remain.', remaining;
  END IF;
  SELECT COUNT(*) INTO remaining FROM public.trips WHERE title_en LIKE '[DEMO]%';
  IF remaining > 0 THEN
    RAISE EXCEPTION 'Cleanup incomplete: % demo trips still remain.', remaining;
  END IF;
END $$;

COMMIT;

NOTICE 'Demo cleanup complete.';
