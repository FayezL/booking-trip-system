-- 1. Extend role constraint to include new types
ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_admin', 'admin', 'servant', 'patient', 'companion', 'family_assistant'));

-- 2. Add new columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS has_wheelchair boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 3. Migrate existing servants to admin
UPDATE public.profiles SET role = 'admin' WHERE role = 'servant';

-- 4. Create is_admin() function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'));
$$;

-- 5. Update is_servant() to delegate to is_admin()
CREATE OR REPLACE FUNCTION public.is_servant()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_admin();
$$;

-- 6. Update handle_new_user() trigger to include has_wheelchair
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, phone, full_name, gender, role, has_wheelchair)
  VALUES (
    NEW.id,
    split_part(NEW.email, '@', 1),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'gender', 'Male'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'patient'),
    COALESCE((NEW.raw_user_meta_data->>'has_wheelchair')::boolean, false)
  );
  RETURN NEW;
END;
$$;

-- 7. New RPC: admin_create_user (replaces admin_create_servant)
CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_phone text,
  p_full_name text,
  p_gender text,
  p_password text,
  p_role text,
  p_has_wheelchair boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_user_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin') THEN
    RAISE EXCEPTION 'Only super admin can create users';
  END IF;

  IF p_role NOT IN ('admin', 'servant', 'patient', 'companion', 'family_assistant') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_user_meta_data
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    p_phone || '@church.local',
    crypt(p_password, gen_salt('bf')),
    now(), now(), now(),
    jsonb_build_object(
      'full_name', p_full_name,
      'gender', p_gender,
      'role', p_role,
      'has_wheelchair', p_has_wheelchair
    )
  ) RETURNING id INTO new_user_id;

  RETURN new_user_id;
END;
$$;

-- 8. New RPC: admin_delete_user (soft delete)
CREATE OR REPLACE FUNCTION public.admin_delete_user(
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin') THEN
    RAISE EXCEPTION 'Only super admin can delete users';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id AND role = 'super_admin') THEN
    RAISE EXCEPTION 'Cannot delete super admin';
  END IF;

  UPDATE public.profiles SET deleted_at = now() WHERE id = p_user_id;
END;
$$;

-- 9. Update register_and_book RPC to accept role and has_wheelchair
-- SECURITY: admin-only + role whitelist + search_path pinned
CREATE OR REPLACE FUNCTION public.register_and_book(
  p_phone text,
  p_full_name text,
  p_gender text,
  p_password text,
  p_trip_id uuid DEFAULT NULL,
  p_bus_id uuid DEFAULT NULL,
  p_role text DEFAULT 'patient',
  p_has_wheelchair boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_user_id uuid;
  v_capacity int;
  v_current int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin users can register new people';
  END IF;

  IF p_role NOT IN ('patient', 'companion', 'family_assistant', 'admin', 'servant') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_user_meta_data
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    p_phone || '@church.local',
    crypt(p_password, gen_salt('bf')),
    now(), now(), now(),
    jsonb_build_object(
      'full_name', p_full_name,
      'gender', p_gender,
      'role', COALESCE(p_role, 'patient'),
      'has_wheelchair', p_has_wheelchair
    )
  ) RETURNING id INTO new_user_id;

  IF p_trip_id IS NOT NULL AND p_bus_id IS NOT NULL THEN
    SELECT capacity INTO v_capacity FROM public.buses WHERE id = p_bus_id FOR UPDATE;
    SELECT COUNT(*) INTO v_current FROM public.bookings WHERE bus_id = p_bus_id AND cancelled_at IS NULL;
    IF v_current >= v_capacity THEN
      RAISE EXCEPTION 'Bus is full';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.trips WHERE id = p_trip_id AND is_open = true) THEN
      RAISE EXCEPTION 'Trip is not open';
    END IF;
    IF EXISTS (SELECT 1 FROM public.bookings WHERE user_id = new_user_id AND trip_id = p_trip_id AND cancelled_at IS NULL) THEN
      RAISE EXCEPTION 'Already booked this trip';
    END IF;
    INSERT INTO public.bookings (user_id, trip_id, bus_id) VALUES (new_user_id, p_trip_id, p_bus_id);
  END IF;

  RETURN new_user_id;
END;
$$;

-- 10. Index for soft delete queries
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at ON public.profiles(deleted_at) WHERE deleted_at IS NOT NULL;
