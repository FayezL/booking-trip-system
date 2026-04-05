# User Types, Wheelchair, Admin Role Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add new user types (companion, family_assistant), wheelchair tracking, split servant/admin roles, add admin user management with delete, and show wheelchair icons in room/bus lists.

**Architecture:** Extend the existing `profiles.role` column with new values. Migrate existing `servant` → `admin` so `servant` becomes a regular non-admin role. Add `has_wheelchair` and `deleted_at` columns. Update all frontend components to reflect the new role structure and display wheelchair icons.

**Tech Stack:** Next.js 14, Supabase (RLS, RPC functions), TypeScript, Tailwind CSS, i18n (ar/en)

---

## Role Architecture

| Role | Admin Panel | Book for Self | Notes |
|---|---|---|---|
| `super_admin` | Yes (full) | Yes | Can manage users, logs, roles |
| `admin` | Yes | Yes | Chosen servant with admin access |
| `servant` | No | Yes | Regular church servant |
| `patient` | No | Yes | Default registration type |
| `companion` | No | Yes | مرافق |
| `family_assistant` | No | Yes | مساعد عائلة |

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/00013_user_types_wheelchair.sql` | Create | DB migration: new roles, columns, functions, RLS updates |
| `src/lib/types/database.ts` | Modify | TypeScript types for new roles and columns |
| `src/lib/i18n/dictionaries/ar.json` | Modify | Arabic translations for new roles/wheelchair |
| `src/lib/i18n/dictionaries/en.json` | Modify | English translations for new roles/wheelchair |
| `src/app/signup/page.tsx` | Modify | Registration: user type dropdown + wheelchair toggle |
| `src/lib/supabase/middleware.ts` | Modify | servant→admin role checks |
| `src/components/Header.tsx` | Modify | servant→admin role check |
| `src/components/MobileNav.tsx` | Modify | servant→admin role check |
| `src/app/(authenticated)/admin/users/page.tsx` | Modify | Add person with any role, wheelchair, delete, soft-delete filter |
| `src/app/(authenticated)/admin/trips/[id]/UnbookedTab.tsx` | Modify | Role + wheelchair in register form, wheelchair icon |
| `src/app/(authenticated)/admin/trips/[id]/RoomsTab.tsx` | Modify | Wheelchair icon next to occupants |
| `src/app/(authenticated)/admin/trips/[id]/BusesTab.tsx` | Modify | Wheelchair icon next to passengers |
| `src/app/(authenticated)/trips/[tripId]/buses/page.tsx` | Modify | Wheelchair icon in public passenger lists |
| `supabase/functions/generate-report/index.ts` | Modify | Fix role check for admin+super_admin |
| `src/__tests__/security/security-audit.test.ts` | Modify | Update servant→admin assertions |

---

### Task 1: SQL Migration

**Files:**
- Create: `supabase/migrations/00013_user_types_wheelchair.sql`

- [ ] **Step 1: Write the migration file**

```sql
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
AS $$
DECLARE
  new_user_id uuid;
  v_capacity int;
  v_current int;
BEGIN
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

-- 10. Add index for soft delete queries
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at ON public.profiles(deleted_at) WHERE deleted_at IS NOT NULL;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/00013_user_types_wheelchair.sql
git commit -m "feat: add user types, wheelchair, admin role split migration"
```

---

### Task 2: TypeScript Types

**Files:**
- Modify: `src/lib/types/database.ts`

- [ ] **Step 1: Update Profile type**

Replace the entire `database.ts` content:

```typescript
export type Profile = {
  id: string;
  phone: string;
  full_name: string;
  gender: "Male" | "Female";
  role: "super_admin" | "admin" | "servant" | "patient" | "companion" | "family_assistant";
  has_wheelchair: boolean;
  deleted_at: string | null;
  created_at: string;
};

export type Area = {
  id: string;
  name_ar: string;
  name_en: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

export type Trip = {
  id: string;
  title_ar: string;
  title_en: string;
  trip_date: string;
  is_open: boolean;
  created_at: string;
};

export type Bus = {
  id: string;
  trip_id: string;
  area_name_ar: string;
  area_name_en: string;
  capacity: number;
  leader_name: string | null;
  area_id: string | null;
  bus_label: string | null;
};

export type Room = {
  id: string;
  trip_id: string;
  room_type: "Male" | "Female";
  capacity: number;
  supervisor_name: string | null;
  room_label: string;
};

export type Booking = {
  id: string;
  user_id: string;
  trip_id: string;
  bus_id: string;
  room_id: string | null;
  created_at: string;
  cancelled_at: string | null;
};

export type AdminLog = {
  id: string;
  admin_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};
```

---

### Task 3: Translations (ar + en)

**Files:**
- Modify: `src/lib/i18n/dictionaries/ar.json`
- Modify: `src/lib/i18n/dictionaries/en.json`

- [ ] **Step 1: Add Arabic translations**

Add these keys to ar.json:

In `auth` section add:
```json
"userType": "نوع المستخدم",
"companion": "مرافق",
"familyAssistant": "مساعد عائلة",
"wheelchair": "معايا كرسي متحرك"
```

In `admin` section add:
```json
"adminRole": "مدير",
"companion": "مرافق",
"familyAssistant": "مساعد عائلة",
"servant": "خادم",
"addPerson": "شخص جديد",
"deleteUser": "مسح المستخدم",
"confirmDeleteUser": "متأكد تمسح المستخدم ده؟",
"userDeleted": "تم مسح المستخدم",
"wheelchair": "كرسي متحرك"
```

- [ ] **Step 2: Add English translations**

Add matching keys to en.json:

In `auth` section add:
```json
"userType": "User Type",
"companion": "Companion",
"familyAssistant": "Family Assistant",
"wheelchair": "Using a wheelchair"
```

In `admin` section add:
```json
"adminRole": "Admin",
"companion": "Companion",
"familyAssistant": "Family Assistant",
"servant": "Servant",
"addPerson": "New Person",
"deleteUser": "Delete User",
"confirmDeleteUser": "Are you sure you want to delete this user?",
"userDeleted": "User has been deleted",
"wheelchair": "Wheelchair"
```

---

### Task 4: Middleware Role Updates

**Files:**
- Modify: `src/lib/supabase/middleware.ts`

- [ ] **Step 1: Replace servant with admin in middleware**

In `src/lib/supabase/middleware.ts`, change:
- Line 52: `profile?.role === "servant"` → `profile?.role === "admin"`
- Line 63: `profile.role !== "servant"` → `profile.role !== "admin"`

Full updated file:

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !pathname.startsWith("/login") && !pathname.startsWith("/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && (pathname.startsWith("/login") || pathname.startsWith("/signup"))) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const url = request.nextUrl.clone();
    url.pathname = (profile?.role === "admin" || profile?.role === "super_admin") ? "/admin" : "/trips";
    return NextResponse.redirect(url);
  }

  if (user && pathname.startsWith("/admin")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
      const url = request.nextUrl.clone();
      url.pathname = "/trips";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
```

---

### Task 5: Header + MobileNav Role Updates

**Files:**
- Modify: `src/components/Header.tsx`
- Modify: `src/components/MobileNav.tsx`

- [ ] **Step 1: Update Header.tsx line 20**

Change `profile.role === "servant"` to `profile.role === "admin"`:

```typescript
const isAdmin = profile.role === "admin" || profile.role === "super_admin";
```

- [ ] **Step 2: Update MobileNav.tsx line 75**

Change `profile.role === "servant"` to `profile.role === "admin"`:

```typescript
const isAdmin = profile.role === "admin" || profile.role === "super_admin";
```

---

### Task 6: Registration Form (Signup Page)

**Files:**
- Modify: `src/app/signup/page.tsx`

- [ ] **Step 1: Rewrite signup page with user type dropdown + wheelchair toggle**

Full updated file:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import LanguageToggle from "@/components/LanguageToggle";
import ThemeToggle from "@/components/ThemeToggle";

type SignupRole = "patient" | "companion" | "family_assistant";

export default function SignupPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState<"Male" | "Female" | "">("");
  const [role, setRole] = useState<SignupRole | "">("");
  const [hasWheelchair, setHasWheelchair] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!phone.trim() || !/^\d{8,15}$/.test(phone.trim())) {
      setError(t("auth.phoneRequired"));
      return;
    }
    if (!fullName.trim()) {
      setError(t("auth.nameRequired"));
      return;
    }
    if (!gender) {
      setError(t("auth.genderRequired"));
      return;
    }
    if (!role) {
      setError(t("auth.userType") + " " + t("auth.passwordRequired").replace(t("auth.passwordRequired"), "").length === 0 ? "" : "");
      setError(t("auth.userType"));
      return;
    }
    if (!password.trim() || password.length < 6) {
      setError(t("auth.passwordRequired"));
      return;
    }

    setLoading(true);
    const email = `${phone.trim()}@church.local`;
    const supabase = createClient();

    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          gender,
          role,
          has_wheelchair: hasWheelchair,
        },
      },
    });

    setLoading(false);

    if (authError) {
      if (authError.message.includes("already registered")) {
        setError(t("auth.phoneExists"));
      } else {
        setError(t("common.error"));
      }
      return;
    }

    router.push("/trips");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-slate-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4">
      <div className="w-full max-w-md animate-slide-up">
        <div className="flex justify-end mb-4">
          <ThemeToggle />
          <LanguageToggle />
        </div>
        <div className="card">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-gray-100">
              {t("auth.signup")}
            </h1>
          </div>

          <form onSubmit={handleSignup} className="space-y-5">
            <div>
              <label className="label-text">{t("auth.phone")}</label>
              <input
                type="tel"
                className="input-field"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                dir="ltr"
                disabled={loading}
              />
            </div>

            <div>
              <label className="label-text">{t("auth.fullName")}</label>
              <input
                type="text"
                className="input-field"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <label className="label-text">{t("auth.gender")}</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setGender("Male")}
                  className={`flex-1 py-3 rounded-xl text-base font-semibold border-2 transition-all duration-150 min-h-[48px]
                    ${gender === "Male"
                      ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-400 shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-600"
                    }`}
                  disabled={loading}
                >
                  {t("auth.male")}
                </button>
                <button
                  type="button"
                  onClick={() => setGender("Female")}
                  className={`flex-1 py-3 rounded-xl text-base font-semibold border-2 transition-all duration-150 min-h-[48px]
                    ${gender === "Female"
                      ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-400 shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-600"
                    }`}
                  disabled={loading}
                >
                  {t("auth.female")}
                </button>
              </div>
            </div>

            <div>
              <label className="label-text">{t("auth.userType")}</label>
              <div className="flex gap-2 flex-wrap">
                {(["patient", "companion", "family_assistant"] as SignupRole[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setRole(r);
                      if (r !== "patient") setHasWheelchair(false);
                    }}
                    className={`flex-1 py-3 rounded-xl text-sm font-semibold border-2 transition-all duration-150 min-h-[48px] min-w-[100px]
                      ${role === r
                        ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-400 shadow-sm"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-600"
                      }`}
                    disabled={loading}
                  >
                    {t(`admin.${r === "patient" ? "patient" : r === "companion" ? "companion" : "familyAssistant"}`)}
                  </button>
                ))}
              </div>
            </div>

            {role === "patient" && (
              <div className="flex items-center gap-3 py-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={hasWheelchair}
                  onClick={() => setHasWheelchair(!hasWheelchair)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    hasWheelchair ? "bg-blue-600" : "bg-slate-200 dark:bg-gray-700"
                  }`}
                  disabled={loading}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      hasWheelchair ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
                <span className="text-sm text-slate-600 dark:text-gray-300">
                  ♿ {t("auth.wheelchair")}
                </span>
              </div>
            )}

            <div>
              <label className="label-text">{t("auth.password")}</label>
              <input
                type="password"
                className="input-field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                dir="ltr"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 p-3 rounded-xl text-center text-base font-medium animate-fade-in">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary w-full"
              disabled={loading}
            >
              {loading ? t("auth.signingUp") : t("auth.signupButton")}
            </button>
          </form>

          <p className="text-center mt-6 text-base text-slate-500 dark:text-gray-400">
            {t("auth.hasAccount")}{" "}
            <a href="/login" className="text-blue-600 dark:text-blue-400 font-semibold hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
              {t("auth.loginHere")}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
```

---

### Task 7: Admin User Management Page

**Files:**
- Modify: `src/app/(authenticated)/admin/users/page.tsx`

- [ ] **Step 1: Rewrite users page with all roles, wheelchair, delete**

This is the largest change. The full updated file replaces the existing content with:
- Role dropdown in "Add Person" form (admin/servant/patient/companion/family_assistant)
- Wheelchair toggle when patient selected in form
- Delete user button (soft delete via admin_delete_user RPC)
- Filter out soft-deleted users
- Show wheelchair icon ♿ next to users with has_wheelchair
- Role filter buttons include all new roles
- Role change as a dropdown instead of toggle

---

### Task 8: UnbookedTab Updates

**Files:**
- Modify: `src/app/(authenticated)/admin/trips/[id]/UnbookedTab.tsx`

- [ ] **Step 1: Add role selector and wheelchair toggle to register form**
- [ ] **Step 2: Pass role and has_wheelchair to register_and_book RPC**
- [ ] **Step 3: Show wheelchair icon in user list**

---

### Task 9: Wheelchair Icons in RoomsTab

**Files:**
- Modify: `src/app/(authenticated)/admin/trips/[id]/RoomsTab.tsx`

- [ ] **Step 1: Fetch has_wheelchair from profiles in loadData**
- [ ] **Step 2: Show ♿ icon next to occupants with has_wheelchair=true**

---

### Task 10: Wheelchair Icons in Admin BusesTab

**Files:**
- Modify: `src/app/(authenticated)/admin/trips/[id]/BusesTab.tsx`

- [ ] **Step 1: Fetch has_wheelchair from booking profiles**
- [ ] **Step 2: Show ♿ icon next to passengers with has_wheelchair=true**

---

### Task 11: Wheelchair Icons in Public Bus Page

**Files:**
- Modify: `src/app/(authenticated)/trips/[tripId]/buses/page.tsx`

- [ ] **Step 1: Fetch has_wheelchair in booking query**
- [ ] **Step 2: Show ♿ icon in passenger lists**

---

### Task 12: Fix Generate Report Edge Function

**Files:**
- Modify: `supabase/functions/generate-report/index.ts`

- [ ] **Step 1: Fix role check on line 53**

Change `profile?.role !== "servant"` to `profile?.role !== "admin" && profile?.role !== "super_admin"`

---

### Task 13: Update Security Tests

**Files:**
- Modify: `src/__tests__/security/security-audit.test.ts`

- [ ] **Step 1: Update servant→admin assertions**

---

### Task 14: Build Verification

- [ ] **Step 1: Run `npm run build` to verify no TypeScript errors**
- [ ] **Step 2: Run `npm run lint` to verify no lint errors**
- [ ] **Step 3: Run `npm test` to verify tests pass**
