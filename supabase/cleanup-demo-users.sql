-- ============================================================
-- CLEANUP DEMO USERS — Deletes all demo users and their data
-- Identified by phone numbers starting with 099
-- Run this in Supabase SQL Editor AFTER recording
-- ============================================================

BEGIN;

-- ============================================================
-- SAFETY CHECK: Make sure demo users exist before deleting
-- ============================================================
DO $$
DECLARE
  demo_count int;
BEGIN
  SELECT COUNT(*) INTO demo_count FROM profiles WHERE phone LIKE '099%';
  IF demo_count = 0 THEN
    RAISE EXCEPTION 'No demo users found (phones starting with 099). Nothing to clean up.';
  END IF;
  RAISE NOTICE 'Found % demo users to delete.', demo_count;
END;
$$;

-- ============================================================
-- STEP 1: Delete bookings for demo family members
-- ============================================================
DELETE FROM bookings
WHERE family_member_id IN (
  SELECT fm.id FROM family_members fm
  WHERE fm.head_user_id IN (SELECT id FROM profiles WHERE phone LIKE '099%')
);

-- ============================================================
-- STEP 2: Delete bookings for demo users
-- ============================================================
DELETE FROM bookings
WHERE user_id IN (SELECT id FROM profiles WHERE phone LIKE '099%');

-- ============================================================
-- STEP 3: Delete family members of demo users
-- ============================================================
DELETE FROM family_members
WHERE head_user_id IN (SELECT id FROM profiles WHERE phone LIKE '099%');

-- ============================================================
-- STEP 4: Delete profiles for demo users
-- ============================================================
DELETE FROM profiles
WHERE phone LIKE '099%';

-- ============================================================
-- STEP 5: Delete auth.users for demo users
-- ============================================================
DELETE FROM auth.users
WHERE id IN (
  SELECT id FROM auth.users
  WHERE email LIKE '099%@church.local'
);

-- ============================================================
-- STEP 6: Verify cleanup
-- ============================================================
DO $$
DECLARE
  remaining int;
BEGIN
  SELECT COUNT(*) INTO remaining FROM profiles WHERE phone LIKE '099%';
  IF remaining > 0 THEN
    RAISE NOTICE 'Warning: % demo profiles still remain.', remaining;
  ELSE
    RAISE NOTICE 'Cleanup complete. All demo users deleted.';
  END IF;
END;
$$;

COMMIT;
