-- Consolidated migration: fix all schema issues. Creates areas table, adds columns to buses and profiles. Creates admin_logs table, functions, RLS policies, RPC functions. This migration is idempotent - safe to reapply.

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('super_admin', 'admin', 'servant', 'patient', 'companion', 'family_assistant'));

CREATE TABLE IF NOT EXISTS public.admin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.profiles(id),
  action text NOT NULL,
  target_type text,
  target_id uuid,
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON public.admin_logs(admin_id);
  CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON public.admin_logs(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON public.admin_logs(action);
END $$;

CREATE TABLE IF NOT EXISTS public.areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar text NOT NULL,
  name_en text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 4,
  created_at timestamptz DEFAULT now(),
  UNIQUE(name_ar, name_en)
);

ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read areas" ON public.areas;
CREATE POLICY "Authenticated users can read areas" ON public.areas FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Servants can manage areas" ON public.areas;
CREATE POLICY "Servants can manage areas" ON public.areas FOR ALL TO authenticated USING (is_servant()) WITH CHECK (is_servant());

ALTER TABLE public.buses ADD COLUMN IF NOT EXISTS area_id uuid REFERENCES public.areas(id) ON DELETE SET NULL;
ALTER TABLE public.buses ADD COLUMN IF NOT EXISTS bus_label text;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS has_wheelchair boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
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
end;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin') AND deleted_at IS NULL);
$$;

CREATE OR REPLACE FUNCTION public.is_servant()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $$
    SELECT public.is_admin();
$$;

DROP POLICY IF EXISTS "Servants can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Servants can insert profiles" ON public.profiles;
drop POLICY IF EXISTS "Servants can manage trips" ON public.trips;
drop POLICY IF EXISTS "Servants can manage buses" ON public.buses;
drop POLICY IF EXISTS "Servants can manage rooms" ON public.rooms;
drop POLICY IF EXISTS "Servants can view all bookings" ON public.bookings;
drop POLICY IF EXISTS "Servants can manage all bookings" on public.bookings;
DROP POLICY IF EXISTS "Super admin can update profiles" ON public.profiles;
drop POLICY IF EXISTS "Super admin can view logs" on public.admin_logs;

DROP POLICY IF EXISTS "Super admin can view all logs" ON public.admin_logs;
DROP POLICY IF EXISTS "Admins can update profiles" on public.profiles;

CREATE POLICY "Servants can view all profiles" ON public.profiles
  FOR SELECT USING (public.is_servant());

CREATE POLICY "Servants can insert profiles" ON public.profiles
 FOR INSERT WITH CHECK (public.is_servant());

CREATE POLICY "Admins can update profiles" ON public.profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin') AND deleted_at IS NULL)
  );

CREATE POLICY "Servants can manage trips" ON public.trips
 FOR ALL USING (public.is_servant());

CREATE POLICY "Servants can manage buses" ON public.buses FOR ALL USING (public.is_servant());

CREATE POLICY "Servants can manage rooms" ON public.rooms FOR ALL USING (public.is_servant());

CREATE POLICY "Servants can view all bookings" ON public.bookings FOR SELECT USING (public.is_servant());

CREATE POLICY "Servants can manage all bookings" on public.bookings FOR ALL USING (public.is_servant());

ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can insert logs" ON public.admin_logs;
CREATE POLICY "Admins can insert logs" ON public.admin_logs FOR INSERT WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Admins can view logs" ON public.admin_logs;
CREATE POLICY "Admins can view logs" ON public.admin_logs FOR SELECT USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.get_trip_passengers(p_trip_id uuid)
RETURNS TABLE(bus_id uuid, full_name text, has_wheelchair boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
    SELECT b.bus_id, p.full_name, p.has_wheelchair
    FROM public.bookings b
    JOIN public.profiles p ON p.id = b.user_id
    WHERE b.trip_id = p_trip_id
      AND b.cancelled_at IS NULL
      AND p.deleted_at IS null
    ORDER BY p.full_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin users can delete users';
  end if;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id AND role = 'super_admin') THEN
    RAISE EXCEPTION 'Cannot delete super admin';
  end if;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND
             EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id AND role = 'admin')) THEN
    RAISE EXCEPTION 'Admins cannot delete other admins';
  end if;
  UPDATE public.profiles SET deleted_at = now() WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reset_password(p_user_id uuid, p_new_password text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin users can reset passwords';
  end if;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id AND role = 'super_admin') THEN
    RAISE EXCEPTION 'Cannot reset super admin password';
  end if;
  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf'))
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_phone text, p_full_name text, p_gender text, p_password text, p_role text, p_has_wheelchair boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  new_user_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin users can create users';
  end if;
  IF p_role NOT IN ('admin', 'servant', 'patient', 'companion', 'family_assistant') THEN
    RAISE EXCEPTION 'Invalid role';
  end if;
  IF p_role = 'super_admin' THEN
    RAISE EXCEPTION 'Cannot create super admin';
  end if;
  IF p_role IN ('admin') AND EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only super admin can create admin users';
  end if;
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
end;
$$;

CREATE OR REPLACE FUNCTION public.register_and_book(
    p_phone text, p_full_name text, p_gender text, p_password text,
    p_trip_id uuid DEFAULT NULL, p_bus_id uuid DEFAULT NULL,
    p_role text DEFAULT 'patient', p_has_wheelchair boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    new_user_id uuid;
    v_capacity int;
    v_current int;
begin
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only admin users can register new people';
    end if;
    IF p_role NOT IN ('patient', 'companion', 'family_assistant', 'admin', 'servant') THEN
        RAISE EXCEPTION 'Invalid role';
    end if;
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
        SELECT COUNT(*) INTO v_current FROM public.bookings WHERE bus_id = p_bus_id AND cancelled_at IS null;
        IF v_current >= v_capacity THEN
            RAISE EXCEPTION 'Bus is full';
        end if;
        IF NOT EXISTS (SELECT 1 FROM public.trips WHERE id = p_trip_id AND is_open = true) THEN
            RAISE EXCEPTION 'Trip is not open';
        end if;
        IF EXISTS (SELECT 1 FROM public.bookings WHERE user_id = new_user_id AND trip_id = p_trip_id AND cancelled_at IS null) THEN
            RAISE EXCEPTION 'Already booked this trip';
        end if;
        INSERT INTO public.bookings (user_id, trip_id, bus_id) VALUES (new_user_id, p_trip_id, p_bus_id);
    end if;
    RETURN new_user_id;
end;
$$;

CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at ON public.profiles(deleted_at) WHERE deleted_at IS NOT NULL;
