-- 00007: Change admin_delete_user from soft delete to hard delete
-- This removes the auth account + profile + bookings completely,
-- freeing the phone number for re-registration.

DROP FUNCTION IF EXISTS public.admin_delete_user(uuid);

CREATE FUNCTION public.admin_delete_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin users can delete users';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id AND role = 'super_admin') THEN
    RAISE EXCEPTION 'Cannot delete super admin';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id AND role = 'admin')
  ) THEN
    RAISE EXCEPTION 'Admins cannot delete other admins';
  END IF;

  DELETE FROM public.bookings WHERE user_id = p_user_id;

  DELETE FROM public.profiles WHERE id = p_user_id;

  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;
