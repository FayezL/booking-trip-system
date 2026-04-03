# Admin Panel Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Remember Me to login, super_admin role, user management page, activity logs page, and admin action logging.

**Architecture:** Add `super_admin` role to existing profiles table. New `admin_logs` table for tracking actions. New admin pages for user management and logs. Simple client-side logging helper. RLS updated so both `servant` and `super_admin` have admin access.

**Tech Stack:** Next.js 14 App Router, Supabase (Auth, PostgreSQL), TypeScript, Tailwind CSS

---

### Task 1: Database migration — super_admin role + admin_logs table + RPCs

**Files:**
- Create: `supabase/migrations/00011_super_admin_and_logs.sql`

- [ ] **Step 1: Create migration**

Create `supabase/migrations/00011_super_admin_and_logs.sql`:

```sql
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
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/00011_super_admin_and_logs.sql
git commit -m "feat: add super_admin role, admin_logs table, and admin RPCs"
```

---

### Task 2: Update TypeScript types + i18n dictionaries

**Files:**
- Modify: `src/lib/types/database.ts`
- Modify: `src/lib/i18n/dictionaries/ar.json`
- Modify: `src/lib/i18n/dictionaries/en.json`

- [ ] **Step 1: Update database types**

Replace `src/lib/types/database.ts` with:

```typescript
export type Profile = {
  id: string;
  phone: string;
  full_name: string;
  gender: "Male" | "Female";
  role: "super_admin" | "servant" | "patient";
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

- [ ] **Step 2: Update Arabic dictionary**

Add these keys inside the `"auth"` section of `src/lib/i18n/dictionaries/ar.json` (after `"welcome"`):

```json
"rememberMe": "تذكرني"
```

Add these keys inside the `"admin"` section (after `"removeRoom"`):

```json
"users": "المستخدمين",
"userManagement": "إدارة المستخدمين",
"activityLogs": "سجل العمليات",
"resetPassword": "إعادة تعيين كلمة السر",
"newPassword": "كلمة السر الجديدة",
"passwordReset": "تم تغيير كلمة السر",
"changeRole": "تغيير الصلاحية",
"role": "الصلاحية",
"searchUsers": "دوّر بالاسم أو الرقم",
"protectedAccount": "حساب محمي",
"noUsers": "مفيش مستخدمين",
"timestamp": "الوقت",
"action": "العملية",
"target": "الهدف",
"details": "التفاصيل",
"filterByAdmin": "فلتر بالمشرف",
"filterByAction": "فلتر بالعملية",
"noLogs": "مفيش سجلات",
"prev": "السابق",
"next": "التالي",
"page": "صفحة",
"superAdmin": "مدير رئيسي",
"servant": "خادم",
"patient": "مريض",
"loginAction": "تسجيل دخول",
"logoutAction": "تسجيل خروج",
"createAction": "إنشاء",
"editAction": "تعديل",
"deleteAction": "مسح",
"resetPasswordAction": "إعادة تعيين كلمة السر",
"changeRoleAction": "تغيير الصلاحية",
"bookAction": "حجز"
```

- [ ] **Step 3: Update English dictionary**

Add these keys inside the `"auth"` section of `src/lib/i18n/dictionaries/en.json` (after `"welcome"`):

```json
"rememberMe": "Remember Me"
```

Add these keys inside the `"admin"` section (after `"removeRoom"`):

```json
"users": "Users",
"userManagement": "User Management",
"activityLogs": "Activity Logs",
"resetPassword": "Reset Password",
"newPassword": "New Password",
"passwordReset": "Password has been reset",
"changeRole": "Change Role",
"role": "Role",
"searchUsers": "Search by name or phone",
"protectedAccount": "Protected Account",
"noUsers": "No users found",
"timestamp": "Time",
"action": "Action",
"target": "Target",
"details": "Details",
"filterByAdmin": "Filter by admin",
"filterByAction": "Filter by action",
"noLogs": "No logs found",
"prev": "Previous",
"next": "Next",
"page": "Page",
"superAdmin": "Super Admin",
"servant": "Servant",
"patient": "Patient",
"loginAction": "Login",
"logoutAction": "Logout",
"createAction": "Create",
"editAction": "Edit",
"deleteAction": "Delete",
"resetPasswordAction": "Reset Password",
"changeRoleAction": "Change Role",
"bookAction": "Book"
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: update types and i18n for super_admin role and admin enhancements"
```

---

### Task 3: Admin logging helper

**Files:**
- Create: `src/lib/admin-logs.ts`

- [ ] **Step 1: Create logging helper**

Create `src/lib/admin-logs.ts`:

```typescript
import { createClient } from "@/lib/supabase/client";

export async function logAction(
  action: string,
  targetType?: string,
  targetId?: string,
  details?: Record<string, unknown>
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("admin_logs").insert({
    admin_id: user.id,
    action,
    target_type: targetType || null,
    target_id: targetId || null,
    details: details || {},
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/admin-logs.ts
git commit -m "feat: add admin action logging helper"
```

---

### Task 4: Remember Me on login page

**Files:**
- Modify: `src/app/login/page.tsx`
- Modify: `src/lib/supabase/client.ts`

- [ ] **Step 1: Update Supabase client with session awareness**

Replace `src/lib/supabase/client.ts` with:

```typescript
import { createBrowserClient } from "@supabase/ssr";

let client: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (client) return client;
  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return client;
}

export function setSessionPersistence(remember: boolean) {
  if (!remember) {
    try {
      const key = `sb-${process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/^https?:\/\//, "")}-auth-token`;
      const value = localStorage.getItem(key);
      if (value) {
        sessionStorage.setItem(key, value);
        localStorage.removeItem(key);
      }
    } catch {}
  }
}
```

- [ ] **Step 2: Update login page with Remember Me checkbox**

Replace `src/app/login/page.tsx` with:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, setSessionPersistence } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import LanguageToggle from "@/components/LanguageToggle";

export default function LoginPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!phone.trim() || !/^\d{8,15}$/.test(phone.trim())) {
      setError(t("auth.phoneRequired"));
      return;
    }
    if (!password.trim() || password.length < 6) {
      setError(t("auth.passwordRequired"));
      return;
    }

    setLoading(true);
    const email = `${phone.trim()}@church.local`;
    const supabase = createClient();

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (authError) {
      setError(t("auth.invalidCredentials"));
      return;
    }

    if (!rememberMe) {
      setSessionPersistence(false);
    }

    router.push("/trips");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-end mb-4">
          <LanguageToggle />
        </div>
        <div className="card">
          <h1 className="text-2xl font-bold text-center mb-8">
            {t("auth.login")}
          </h1>

          <form onSubmit={handleLogin} className="space-y-6">
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

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="rememberMe" className="text-sm text-gray-600">
                {t("auth.rememberMe")}
              </label>
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 p-3 rounded-lg text-center text-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary w-full"
              disabled={loading}
            >
              {loading ? t("auth.loggingIn") : t("auth.loginButton")}
            </button>
          </form>

          <p className="text-center mt-6 text-lg text-gray-600">
            {t("auth.noAccount")}{" "}
            <a href="/signup" className="text-emerald-600 font-semibold hover:underline">
              {t("auth.registerHere")}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add Remember Me checkbox to login page"
```

---

### Task 5: Update middleware for super_admin

**Files:**
- Modify: `src/lib/supabase/middleware.ts`

- [ ] **Step 1: Update middleware to allow super_admin access to admin routes**

In `src/lib/supabase/middleware.ts`, change the redirect after login (line 52) to also handle `super_admin`:

Replace:
```typescript
    url.pathname = profile?.role === "servant" ? "/admin" : "/trips";
```

With:
```typescript
    url.pathname = (profile?.role === "servant" || profile?.role === "super_admin") ? "/admin" : "/trips";
```

And change the admin access check (line 63):

Replace:
```typescript
    if (!profile || profile.role !== "servant") {
```

With:
```typescript
    if (!profile || (profile.role !== "servant" && profile.role !== "super_admin")) {
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: update middleware to support super_admin role"
```

---

### Task 6: Update Header for super_admin nav

**Files:**
- Modify: `src/components/Header.tsx`

- [ ] **Step 1: Update Header to show Users and Logs nav for super_admin**

Replace `src/components/Header.tsx` with:

```typescript
"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import LanguageToggle from "./LanguageToggle";
import type { Profile } from "@/lib/types/database";

interface HeaderProps {
  profile: Profile;
}

export default function Header({ profile }: HeaderProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const supabase = createClient();

  const isAdmin = profile.role === "servant" || profile.role === "super_admin";

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1
            className="text-xl font-bold text-emerald-700 cursor-pointer"
            onClick={() => router.push(isAdmin ? "/admin" : "/trips")}
          >
            Verena Church
          </h1>
          {isAdmin && (
            <nav className="flex gap-2 flex-wrap">
              <button
                onClick={() => router.push("/admin")}
                className="px-3 py-1.5 text-sm font-medium rounded-md hover:bg-gray-100 transition-colors"
              >
                {t("admin.dashboard")}
              </button>
              <button
                onClick={() => router.push("/admin/trips")}
                className="px-3 py-1.5 text-sm font-medium rounded-md hover:bg-gray-100 transition-colors"
              >
                {t("admin.trips")}
              </button>
              <button
                onClick={() => router.push("/admin/reports")}
                className="px-3 py-1.5 text-sm font-medium rounded-md hover:bg-gray-100 transition-colors"
              >
                {t("admin.reports")}
              </button>
              {profile.role === "super_admin" && (
                <>
                  <button
                    onClick={() => router.push("/admin/users")}
                    className="px-3 py-1.5 text-sm font-medium rounded-md hover:bg-gray-100 transition-colors"
                  >
                    {t("admin.users")}
                  </button>
                  <button
                    onClick={() => router.push("/admin/logs")}
                    className="px-3 py-1.5 text-sm font-medium rounded-md hover:bg-gray-100 transition-colors"
                  >
                    {t("admin.activityLogs")}
                  </button>
                </>
              )}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">
            {t("auth.welcome")}، {profile.full_name}
          </span>
          <LanguageToggle />
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 text-sm font-medium text-red-600 rounded-md hover:bg-red-50 transition-colors"
          >
            {t("auth.logout")}
          </button>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add Users and Logs nav for super_admin in Header"
```

---

### Task 7: User Management page (super_admin only)

**Files:**
- Create: `src/app/(authenticated)/admin/users/page.tsx`

- [ ] **Step 1: Create users management page**

Create `src/app/(authenticated)/admin/users/page.tsx`:

```typescript
"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useToast } from "@/components/Toast";
import LoadingSpinner from "@/components/LoadingSpinner";
import { logAction } from "@/lib/admin-logs";
import type { Profile } from "@/lib/types/database";

export default function UsersPage() {
  const { t } = useTranslation();
  const supabase = createClient();
  const { showToast } = useToast();

  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);

  const PAGE_SIZE = 20;

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    setUsers(data || []);
    setLoading(false);
  }

  async function handleResetPassword() {
    if (!resetUserId || !newPassword || newPassword.length < 6) {
      showToast(t("common.error"), "error");
      return;
    }

    setSaving(true);
    const { error } = await supabase.rpc("admin_reset_password", {
      p_user_id: resetUserId,
      p_new_password: newPassword,
    });
    setSaving(false);

    if (error) {
      showToast(t("common.error"), "error");
    } else {
      showToast(t("admin.passwordReset"), "success");
      logAction("reset_password", "user", resetUserId);
      setResetUserId(null);
      setNewPassword("");
    }
  }

  async function handleChangeRole(userId: string, currentRole: string) {
    const newRole = currentRole === "patient" ? "servant" : "patient";
    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", userId);

    if (error) {
      showToast(t("common.error"), "error");
    } else {
      showToast(t("admin.changeRole"), "success");
      logAction("change_role", "user", userId, { from: currentRole, to: newRole });
      loadUsers();
    }
  }

  const filtered = useMemo(() => users.filter((u) => {
    const matchesSearch = !search || u.full_name.includes(search) || u.phone.includes(search);
    const matchesRole = !roleFilter || u.role === roleFilter;
    return matchesSearch && matchesRole;
  }), [users, search, roleFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);

  useEffect(() => { setPage(1); }, [search, roleFilter]);

  if (loading) {
    return <LoadingSpinner text={t("common.loading")} />;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t("admin.userManagement")}</h1>

      <div className="flex gap-3 mb-4">
        <input
          className="input-field max-w-xs"
          placeholder={t("admin.searchUsers")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-1">
          {["", "super_admin", "servant", "patient"].map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                roleFilter === r
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {r === "" ? t("admin.all") : t(`admin.${r === "super_admin" ? "superAdmin" : r}`)}
            </button>
          ))}
        </div>
      </div>

      {resetUserId && (
        <div className="card mb-4">
          <h3 className="text-lg font-bold mb-3">{t("admin.resetPassword")}</h3>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="label-text">{t("admin.newPassword")}</label>
              <input
                type="password"
                className="input-field"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                dir="ltr"
                placeholder="••••••••"
              />
            </div>
            <button onClick={handleResetPassword} disabled={saving} className="btn-primary">
              {saving ? t("common.loading") : t("admin.resetPassword")}
            </button>
            <button onClick={() => { setResetUserId(null); setNewPassword(""); }} className="btn-secondary">
              {t("admin.cancel")}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {paginated.map((u) => (
          <div key={u.id} className="card">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium">{u.full_name}</span>
                <span className="text-sm text-gray-500 ms-2" dir="ltr">{u.phone}</span>
                <span className={`text-xs px-2 py-0.5 rounded ms-2 ${
                  u.role === "super_admin" ? "bg-yellow-100 text-yellow-700" :
                  u.role === "servant" ? "bg-blue-100 text-blue-700" :
                  "bg-gray-100 text-gray-700"
                }`}>
                  {u.role === "super_admin" ? t("admin.superAdmin") :
                   u.role === "servant" ? t("admin.servant") : t("admin.patient")}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded ms-1 ${
                  u.gender === "Male" ? "bg-blue-50 text-blue-600" : "bg-pink-50 text-pink-600"
                }`}>
                  {u.gender === "Male" ? t("auth.male") : t("auth.female")}
                </span>
              </div>
              <div className="flex gap-2">
                {u.role !== "super_admin" && (
                  <>
                    <button
                      onClick={() => handleChangeRole(u.id, u.role)}
                      className="px-3 py-1.5 rounded-md text-sm font-medium bg-blue-100 text-blue-700 hover:bg-blue-200"
                    >
                      {u.role === "patient" ? t("admin.servant") : t("admin.patient")}
                    </button>
                    <button
                      onClick={() => setResetUserId(u.id)}
                      className="px-3 py-1.5 rounded-md text-sm font-medium bg-orange-100 text-orange-700 hover:bg-orange-200"
                    >
                      {t("admin.resetPassword")}
                    </button>
                  </>
                )}
                {u.role === "super_admin" && (
                  <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded">
                    {t("admin.protectedAccount")}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-gray-500 text-center py-4">{t("admin.noUsers")}</p>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-md text-sm font-medium bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
            >
              ←
            </button>
            <span className="text-sm text-gray-600">{page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-md text-sm font-medium bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
            >
              →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add user management page for super_admin"
```

---

### Task 8: Activity Logs page (super_admin only)

**Files:**
- Create: `src/app/(authenticated)/admin/logs/page.tsx`

- [ ] **Step 1: Create activity logs page**

Create `src/app/(authenticated)/admin/logs/page.tsx`:

```typescript
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { AdminLog, Profile } from "@/lib/types/database";

type LogWithAdmin = AdminLog & { profiles: { full_name: string } };

const ACTION_LABELS: Record<string, string> = {
  login: "loginAction",
  logout: "logoutAction",
  create_trip: "createAction",
  edit_trip: "editAction",
  delete_trip: "deleteAction",
  toggle_trip: "editAction",
  create_bus: "createAction",
  edit_bus: "editAction",
  delete_bus: "deleteAction",
  create_room: "createAction",
  edit_room: "editAction",
  delete_room: "deleteAction",
  book_user: "bookAction",
  cancel_booking: "deleteAction",
  assign_room: "editAction",
  register_patient: "createAction",
  reset_password: "resetPasswordAction",
  change_role: "changeRoleAction",
};

export default function LogsPage() {
  const { t } = useTranslation();
  const supabase = createClient();

  const [logs, setLogs] = useState<LogWithAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");
  const [page, setPage] = useState(1);

  const PAGE_SIZE = 30;

  useEffect(() => {
    loadLogs();
  }, []);

  async function loadLogs() {
    let query = supabase
      .from("admin_logs")
      .select("*, profiles!admin_logs_admin_id_fkey(full_name)")
      .order("created_at", { ascending: false })
      .limit(500);

    if (actionFilter) {
      query = query.eq("action", actionFilter);
    }

    const { data } = await query;
    setLogs((data || []) as unknown as LogWithAdmin[]);
    setLoading(false);
  }

  useEffect(() => {
    loadLogs();
    setPage(1);
  }, [actionFilter]);

  const totalPages = Math.ceil(logs.length / PAGE_SIZE);
  const paginated = logs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const actionTypes = ["login", "logout", "create_trip", "edit_trip", "delete_trip", "toggle_trip", "create_bus", "edit_bus", "delete_bus", "create_room", "edit_room", "delete_room", "book_user", "cancel_booking", "assign_room", "register_patient", "reset_password", "change_role"];

  function formatTimestamp(ts: string) {
    return new Date(ts).toLocaleString("ar-EG", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (loading) {
    return <LoadingSpinner text={t("common.loading")} />;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t("admin.activityLogs")}</h1>

      <div className="flex gap-3 mb-4">
        <select
          className="input-field max-w-xs"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
        >
          <option value="">— {t("admin.filterByAction")} —</option>
          {actionTypes.map((a) => (
            <option key={a} value={a}>
              {t(`admin.${ACTION_LABELS[a] || "action"}`)} ({a})
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        {paginated.map((log) => (
          <div key={log.id} className="card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500" dir="ltr">
                  {formatTimestamp(log.created_at)}
                </span>
                <span className="font-medium text-sm">
                  {log.profiles?.full_name || "—"}
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">
                  {t(`admin.${ACTION_LABELS[log.action] || "action"}`)}
                </span>
                {log.target_type && (
                  <span className="text-xs text-gray-500">
                    {log.target_type}{log.target_id ? `: ${log.target_id.slice(0, 8)}...` : ""}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
        {logs.length === 0 && (
          <p className="text-gray-500 text-center py-4">{t("admin.noLogs")}</p>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-md text-sm font-medium bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
            >
              ←
            </button>
            <span className="text-sm text-gray-600">{page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-md text-sm font-medium bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
            >
              →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add activity logs page for super_admin"
```

---

### Task 9: Add logging to existing admin pages

**Files:**
- Modify: `src/app/(authenticated)/admin/trips/page.tsx`
- Modify: `src/app/(authenticated)/admin/trips/[id]/BusesTab.tsx`
- Modify: `src/app/(authenticated)/admin/trips/[id]/RoomsTab.tsx`
- Modify: `src/app/(authenticated)/admin/trips/[id]/UnbookedTab.tsx`

- [ ] **Step 1: Add logging to trips page**

In `src/app/(authenticated)/admin/trips/page.tsx`:

Add import at top:
```typescript
import { logAction } from "@/lib/admin-logs";
```

After the success toast in `handleSave` (inside the `if (editingId)` block), add:
```typescript
logAction(editingId ? "edit_trip" : "create_trip", "trip", editingId || undefined);
```

After the success toast in `handleDelete`, add:
```typescript
logAction("delete_trip", "trip", id);
```

After `if (!error) loadTrips();` in `toggleOpen`, change to:
```typescript
if (!error) {
  logAction("toggle_trip", "trip", trip.id);
  loadTrips();
}
```

- [ ] **Step 2: Add logging to BusesTab**

In `src/app/(authenticated)/admin/trips/[id]/BusesTab.tsx`:

Add import at top:
```typescript
import { logAction } from "@/lib/admin-logs";
```

After the success toast in `handleSave` (for both edit and create branches), add:
```typescript
logAction(editingId ? "edit_bus" : "create_bus", "bus", editingId || undefined);
```

After the success toast in `handleDelete`, add:
```typescript
logAction("delete_bus", "bus", id);
```

- [ ] **Step 3: Add logging to RoomsTab**

In `src/app/(authenticated)/admin/trips/[id]/RoomsTab.tsx`:

Add import at top:
```typescript
import { logAction } from "@/lib/admin-logs";
```

After the success toast in `handleSave` (for both edit and create branches), add:
```typescript
logAction(editingId ? "edit_room" : "create_room", "room", editingId || undefined);
```

After the success toast in `handleDelete`, add:
```typescript
logAction("delete_room", "room", id);
```

After the success toast in `handleAssign`, add:
```typescript
logAction("assign_room", "booking", bookingId);
```

- [ ] **Step 4: Add logging to UnbookedTab**

In `src/app/(authenticated)/admin/trips/[id]/UnbookedTab.tsx`:

Add import at top:
```typescript
import { logAction } from "@/lib/admin-logs";
```

After the success toast in `confirmBookForUser`, add:
```typescript
logAction("book_user", "booking", undefined, { user_id: bookingUser });
```

After the success toast in `handleRegister`, add:
```typescript
logAction("register_patient", "user", undefined, { phone: form.phone });
```

- [ ] **Step 5: Verify build**

```bash
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add admin action logging to all admin CRUD operations"
```

---

### Task 10: Final build verification

- [ ] **Step 1: Run full build**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: resolve build issues from admin enhancement"
```
