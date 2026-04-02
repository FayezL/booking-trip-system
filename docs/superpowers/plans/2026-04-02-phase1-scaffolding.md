# Phase 1: Project Scaffolding & Database Setup

> **Goal:** Scaffold Next.js app, configure Supabase clients, create all DB tables with migrations, and define TypeScript types.

**Architecture:** Next.js 14 App Router with TypeScript. Supabase for PostgreSQL + Auth. Tailwind CSS for styling with elderly-friendly design tokens.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Supabase (@supabase/ssr, @supabase/supabase-js)

---

### Task 1: Initialize Next.js project with TypeScript and Tailwind

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`

- [ ] **Step 1: Scaffold Next.js app**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack --use-npm
```

Expected: Project scaffolded with `src/app/layout.tsx`, `src/app/page.tsx`, etc.

- [ ] **Step 2: Install Supabase dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 3: Verify dev server starts**

```bash
npm run dev &
sleep 5
curl -s http://localhost:3000 | head -20
kill %1
```

Expected: HTML response containing the default Next.js page.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with TypeScript and Tailwind"
```

---

### Task 2: Tailwind config for elderly-friendly design + RTL support

**Files:**
- Modify: `tailwind.config.ts`
- Create: `src/app/globals.css`

- [ ] **Step 1: Write globals.css with RTL and elderly-friendly base styles**

Create `src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html {
    font-size: 18px;
    min-height: 100vh;
  }

  body {
    @apply bg-gray-50 text-gray-900 antialiased;
  }

  [dir="rtl"] {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  }

  [dir="ltr"] {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  }
}

@layer components {
  .btn-primary {
    @apply bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-lg
           min-h-[48px] text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed
           focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2;
  }

  .btn-secondary {
    @apply bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 px-6 rounded-lg
           min-h-[48px] text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed
           focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2;
  }

  .btn-danger {
    @apply bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg
           min-h-[48px] text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed
           focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2;
  }

  .card {
    @apply bg-white rounded-xl shadow-md p-6 border border-gray-100;
  }

  .input-field {
    @apply w-full px-4 py-3 text-lg border border-gray-300 rounded-lg
           focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent
           min-h-[48px];
  }

  .label-text {
    @apply block text-lg font-semibold mb-2 text-gray-700;
  }
}
```

- [ ] **Step 2: Update tailwind.config.ts**

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        available: { DEFAULT: "#16a34a", light: "#bbf7d0", bg: "#f0fdf4" },
        full: { DEFAULT: "#dc2626", light: "#fecaca", bg: "#fef2f2" },
        closed: { DEFAULT: "#9ca3af", light: "#e5e7eb", bg: "#f3f4f6" },
      },
    },
  },
  plugins: [],
};
export default config;
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: configure Tailwind with elderly-friendly styles and RTL support"
```

---

### Task 3: Supabase client utilities (browser + server + middleware)

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/middleware.ts`
- Create: `.env.local.example`

- [ ] **Step 1: Create .env.local.example**

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

- [ ] **Step 2: Create browser Supabase client**

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 3: Create server Supabase client**

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}
```

- [ ] **Step 4: Create Supabase middleware helper with auth redirects**

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  if (user && (pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/trips", request.url));
  }
  if (!user && pathname !== "/login" && pathname !== "/signup") {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return supabaseResponse;
}
```

- [ ] **Step 5: Create `src/middleware.ts`**

```typescript
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add Supabase client utilities for browser, server, and middleware"
```

---

### Task 4: Database migrations — all tables + indexes

**Files:**
- Create: `supabase/migrations/00001_create_profiles.sql`
- Create: `supabase/migrations/00002_create_trips.sql`
- Create: `supabase/migrations/00003_create_buses.sql`
- Create: `supabase/migrations/00004_create_rooms.sql`
- Create: `supabase/migrations/00005_create_bookings.sql`
- Create: `supabase/migrations/00006_create_indexes.sql`

- [ ] **Step 1: Create profiles table with auth trigger**

```sql
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text UNIQUE NOT NULL,
  full_name text NOT NULL,
  gender text NOT NULL CHECK (gender IN ('Male', 'Female')),
  role text NOT NULL DEFAULT 'patient' CHECK (role IN ('servant', 'patient')),
  created_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, phone, full_name, gender, role)
  VALUES (
    NEW.id,
    SPLIT_PART(NEW.email, '@', 1),
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(NEW.raw_user_meta_data->>'gender', 'Male'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'patient')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

- [ ] **Step 2: Create trips table**

```sql
CREATE TABLE public.trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_ar text NOT NULL,
  title_en text NOT NULL,
  trip_date date NOT NULL,
  is_open boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
```

- [ ] **Step 3: Create buses table**

```sql
CREATE TABLE public.buses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  area_name_ar text NOT NULL,
  area_name_en text NOT NULL,
  capacity int NOT NULL CHECK (capacity > 0),
  leader_name text
);
```

- [ ] **Step 4: Create rooms table**

```sql
CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  room_type text NOT NULL CHECK (room_type IN ('Male', 'Female')),
  capacity int NOT NULL CHECK (capacity > 0),
  supervisor_name text,
  room_label text NOT NULL
);
```

- [ ] **Step 5: Create bookings table with unique constraint**

```sql
CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  trip_id uuid NOT NULL REFERENCES public.trips(id),
  bus_id uuid NOT NULL REFERENCES public.buses(id),
  room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  cancelled_at timestamptz
);

CREATE UNIQUE INDEX bookings_active_unique
  ON public.bookings (user_id, trip_id)
  WHERE cancelled_at IS NULL;
```

- [ ] **Step 6: Create indexes**

```sql
CREATE INDEX idx_bookings_trip_id ON public.bookings(trip_id);
CREATE INDEX idx_bookings_bus_id ON public.bookings(bus_id);
CREATE INDEX idx_bookings_room_id ON public.bookings(room_id);
CREATE INDEX idx_bookings_user_id ON public.bookings(user_id);
CREATE INDEX idx_profiles_phone ON public.profiles(phone);
```

- [ ] **Step 7: Commit**

```bash
mkdir -p supabase/migrations
git add -A
git commit -m "feat: add database migrations for all tables, indexes, and triggers"
```

---

### Task 5: RPC functions for booking operations

**Files:**
- Create: `supabase/migrations/00007_create_rpc_functions.sql`

- [ ] **Step 1: Create register_and_book RPC**

```sql
CREATE OR REPLACE FUNCTION public.register_and_book(
  p_phone text, p_full_name text, p_gender text, p_password text,
  p_trip_id uuid DEFAULT NULL, p_bus_id uuid DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  new_user_id uuid; bus_capacity int; current_bookings int;
BEGIN
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_user_meta_data)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated',
    'authenticated', p_phone || '@church.local', crypt(p_password, gen_salt('bf')),
    now(), now(), now(),
    jsonb_build_object('full_name', p_full_name, 'gender', p_gender, 'role', 'patient'))
  RETURNING id INTO new_user_id;

  IF p_trip_id IS NOT NULL AND p_bus_id IS NOT NULL THEN
    SELECT capacity INTO bus_capacity FROM public.buses WHERE id = p_bus_id FOR UPDATE;
    SELECT COUNT(*) INTO current_bookings FROM public.bookings WHERE bus_id = p_bus_id AND cancelled_at IS NULL;
    IF current_bookings >= bus_capacity THEN RAISE EXCEPTION 'Bus is full'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.trips WHERE id = p_trip_id AND is_open = true) THEN RAISE EXCEPTION 'Trip is not open'; END IF;
    IF EXISTS (SELECT 1 FROM public.bookings WHERE user_id = new_user_id AND trip_id = p_trip_id AND cancelled_at IS NULL) THEN RAISE EXCEPTION 'Already booked'; END IF;
    INSERT INTO public.bookings (user_id, trip_id, bus_id) VALUES (new_user_id, p_trip_id, p_bus_id);
  END IF;
  RETURN new_user_id;
END;
$$;
```

- [ ] **Step 2: Create assign_room RPC**

```sql
CREATE OR REPLACE FUNCTION public.assign_room(p_booking_id uuid, p_room_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_gender text; v_room_type text; v_room_capacity int; v_current_occupants int;
BEGIN
  SELECT p.gender INTO v_gender FROM public.bookings b JOIN public.profiles p ON p.id = b.user_id
    WHERE b.id = p_booking_id AND b.cancelled_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;
  SELECT room_type, capacity INTO v_room_type, v_room_capacity FROM public.rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Room not found'; END IF;
  IF v_gender != v_room_type THEN RAISE EXCEPTION 'Gender mismatch'; END IF;
  SELECT COUNT(*) INTO v_current_occupants FROM public.bookings WHERE room_id = p_room_id AND cancelled_at IS NULL;
  IF v_current_occupants >= v_room_capacity THEN RAISE EXCEPTION 'Room is full'; END IF;
  UPDATE public.bookings SET room_id = p_room_id WHERE id = p_booking_id;
END;
$$;
```

- [ ] **Step 3: Create cancel_booking RPC**

```sql
CREATE OR REPLACE FUNCTION public.cancel_booking(p_booking_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.bookings SET cancelled_at = now(), room_id = NULL WHERE id = p_booking_id AND cancelled_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found or already cancelled'; END IF;
END;
$$;
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add RPC functions for register_and_book, assign_room, cancel_booking"
```

---

### Task 6: TypeScript types for database schema

**Files:**
- Create: `src/lib/types/database.ts`

- [ ] **Step 1: Write database type definitions**

```typescript
export type Gender = "Male" | "Female";
export type Role = "servant" | "patient";

export interface Profile {
  id: string;
  phone: string;
  full_name: string;
  gender: Gender;
  role: Role;
  created_at: string;
}

export interface Trip {
  id: string;
  title_ar: string;
  title_en: string;
  trip_date: string;
  is_open: boolean;
  created_at: string;
}

export interface Bus {
  id: string;
  trip_id: string;
  area_name_ar: string;
  area_name_en: string;
  capacity: number;
  leader_name: string | null;
}

export interface Room {
  id: string;
  trip_id: string;
  room_type: Gender;
  capacity: number;
  supervisor_name: string | null;
  room_label: string;
}

export interface Booking {
  id: string;
  user_id: string;
  trip_id: string;
  bus_id: string;
  room_id: string | null;
  created_at: string;
  cancelled_at: string | null;
}

export interface BookingWithDetails extends Booking {
  profiles: Pick<Profile, "full_name" | "phone" | "gender">;
  trips: Pick<Trip, "title_ar" | "title_en" | "trip_date">;
  buses: Pick<Bus, "area_name_ar" | "area_name_en" | "leader_name">;
  rooms: Pick<Room, "room_label" | "room_type" | "supervisor_name"> | null;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add TypeScript types for database schema"
```
