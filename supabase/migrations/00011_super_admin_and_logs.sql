-- 1. Add super_admin to role check constraint
ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_admin', 'servant', 'patient'));

-- 2. Update is_servant() to include super_admin
CREATE OR REPLACE FUNCTION public.is_servant()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('servant', 'super_admin'));
$$;

-- 3. Create admin_logs table
CREATE TABLE public.admin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.profiles(id),
  action text NOT NULL,
  target_type text,
  target_id uuid,
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_admin_logs_admin_id ON public.admin_logs(admin_id);
CREATE INDEX idx_admin_logs_created_at ON public.admin_logs(created_at DESC);
CREATE INDEX idx_admin_logs_action ON public.admin_logs(action);

-- 4. RLS on admin_logs
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can insert logs" ON public.admin_logs
  FOR INSERT WITH CHECK (public.is_servant());

CREATE POLICY "Super admin can view logs" ON public.admin_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- 5. Super admin can update profiles (for role changes)
CREATE POLICY "Super admin can update profiles" ON public.profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- 6. RPC: admin_reset_password
CREATE OR REPLACE FUNCTION public.admin_reset_password(
  p_user_id uuid,
  p_new_password text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin') THEN
    RAISE EXCEPTION 'Only super admin can reset passwords';
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf'))
  WHERE id = p_user_id;
END;
$$;

-- 7. RPC: admin_create_servant (super_admin only)
CREATE OR REPLACE FUNCTION public.admin_create_servant(
  p_phone text,
  p_full_name text,
  p_gender text,
  p_password text
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
    RAISE EXCEPTION 'Only super admin can create servants';
  END IF;

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_user_meta_data
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    p_phone || '@church.local',
    crypt(p_password, gen_salt('bf')),
    now(),
    now(),
    now(),
    jsonb_build_object('full_name', p_full_name, 'gender', p_gender, 'role', 'servant')
  ) RETURNING id INTO new_user_id;

  RETURN new_user_id;
END;
$$;
