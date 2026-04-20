-- 00008: Fix FK cascades so users can be hard-deleted

BEGIN;

ALTER TABLE public.bookings
  DROP CONSTRAINT bookings_user_id_fkey,
  ADD CONSTRAINT bookings_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.admin_logs
  DROP CONSTRAINT admin_logs_admin_id_fkey,
  ADD CONSTRAINT admin_logs_admin_id_fkey
    FOREIGN KEY (admin_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

COMMIT;
