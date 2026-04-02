CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text UNIQUE NOT NULL,
  full_name text NOT NULL,
  gender text NOT NULL CHECK (gender IN ('Male', 'Female')),
  role text NOT NULL DEFAULT 'patient' CHECK (role IN ('servant', 'patient')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_profiles_phone ON public.profiles(phone);
