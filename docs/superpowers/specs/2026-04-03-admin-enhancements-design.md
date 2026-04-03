# Admin Panel Enhancement + Login Improvements Design

**Date:** 2026-04-03
**Status:** Approved

## Overview

Enhance the admin panel with a super_admin role, user management, activity logging, and add a "Remember Me" option to the login page.

## 1. Remember Me (Login Enhancement)

Add a "Remember Me" checkbox on the login page below the password field.

- **Checked (default):** Supabase session persists in localStorage. User stays logged in across browser restarts.
- **Unchecked:** After successful login, move the Supabase session from localStorage to sessionStorage. Session dies when the browser tab closes.

Implementation: After `signInWithPassword` succeeds, if "Remember Me" is unchecked, read the session from localStorage, write it to sessionStorage, then clear the Supabase key from localStorage. On the Supabase client side, detect if the session exists in sessionStorage and use that.

Alternative simpler approach: Use Supabase's `persistSession` option. When unchecked, set `persistSession: false` which uses memory-only storage. But this requires creating the client after the form submission with different options.

Chosen approach: Custom storage adapter. Create the Supabase client with a custom `storage` option that reads from localStorage or sessionStorage based on a flag set during login.

### i18n keys needed

- `auth.rememberMe` (AR: "تذكرني", EN: "Remember Me")

## 2. New Role: super_admin

### Database change

Update the profiles table role constraint to include `super_admin`. The role enum changes from `('servant', 'patient')` to `('super_admin', 'servant', 'patient')`.

### Role hierarchy

| Role | Permissions |
|------|------------|
| `super_admin` | Full access: manage servants, view logs, reset passwords, all CRUD. Cannot be modified by anyone. |
| `servant` | Existing admin: manage trips, buses, rooms, bookings, register patients. Cannot manage admins or view logs. |
| `patient` | Book trips, view own bookings. No admin access. |

### Protection rules

- The `super_admin` account cannot be edited, deleted, or have its role changed (enforced at DB RLS level and app-level checks)
- Only `super_admin` can: promote/demote servants, view activity logs, reset user passwords, access `/admin/users` and `/admin/logs`
- Servants continue to access existing admin pages (`/admin`, `/admin/trips`, `/admin/reports`)
- Header nav: `super_admin` sees all nav items (Dashboard, Trips, Reports, Users, Logs). `servant` sees Dashboard, Trips, Reports only.

### Setting up the super_admin

After migration, manually update the target user's profile:
```sql
UPDATE profiles SET role = 'super_admin' WHERE phone = '<your_phone>';
```

## 3. Admin Activity Logs

### New table: admin_logs

```sql
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
```

### Logged actions

| Category | Actions |
|----------|---------|
| Auth | `login`, `logout` |
| Trips | `create_trip`, `edit_trip`, `delete_trip`, `toggle_trip` |
| Buses | `create_bus`, `edit_bus`, `delete_bus` |
| Rooms | `create_room`, `edit_room`, `delete_room` |
| Bookings | `book_user`, `cancel_booking`, `assign_room` |
| Users | `register_patient`, `reset_password`, `change_role` |

### Implementation

Create a helper function `logAdminAction(supabase, adminId, action, targetType, targetId, details)` that inserts into `admin_logs`. This is called after every admin mutation in the admin UI components.

This will be a client-side utility function in `src/lib/admin-logs.ts`.

### RLS

- `super_admin`: full read access on `admin_logs`
- `servant`: no access
- INSERT: allowed for authenticated users with role `servant` or `super_admin` (they log their own actions)

## 4. User Management Page (super_admin only)

**Route:** `/admin/users`

### Features

- List all users with columns: name, phone, gender, role, created date
- Search by name or phone
- Filter by role (all, patient, servant, super_admin) and gender
- Click a user to see details panel
- Actions per user:
  - **View details:** name, phone, gender, role, registration date, booking history
  - **Reset password:** admin sets a new password for the user
  - **Change role:** toggle between patient and servant (never to/from super_admin)
- The super_admin account row shows a lock icon and cannot be interacted with

### Password reset flow

1. Admin clicks "Reset Password" on a user
2. Modal opens asking for new password
3. On submit, call a Supabase RPC `admin_reset_password(user_id, new_password)` that uses `SECURITY DEFINER` to update `auth.users.encrypted_password`
4. Log the action

### i18n keys needed

- `admin.users` / `admin.userManagement`
- `admin.resetPassword` / `admin.newPassword` / `admin.passwordReset`
- `admin.changeRole` / `admin.role`
- `admin.searchUsers`
- `admin.protectedAccount`
- `admin.noUsers`

## 5. Activity Logs Page (super_admin only)

**Route:** `/admin/logs`

### Features

- Paginated table: timestamp, admin name, action, target type, target name, details
- Filter by: admin (dropdown), action type (dropdown), date range
- Default sort: newest first
- 50 entries per page with prev/next pagination

### i18n keys needed

- `admin.activityLogs`
- `admin.timestamp` / `admin.action` / `admin.target` / `admin.details`
- `admin.filterByAdmin` / `admin.filterByAction` / `admin.filterByDate`
- `admin.noLogs` / `admin.prev` / `admin.next`
- `admin.page`

## 6. Admin Panel Access

No changes needed. The existing middleware and role-based header already work:
- servant/super_admin see admin links in header
- Middleware redirects patients away from `/admin`
- New pages (`/admin/users`, `/admin/logs`) add a server-side check: only `super_admin` role can access

## 7. Database Migrations Summary

1. **Migration: Add super_admin role + admin_logs table**
   - Alter profiles role check constraint to include `super_admin`
   - Create `admin_logs` table with indexes
   - Create `admin_reset_password` RPC function
   - Set up RLS for `admin_logs`

## 8. Files to Create/Modify

### New files
- `supabase/migrations/00011_super_admin_and_logs.sql`
- `src/lib/admin-logs.ts` — helper for logging admin actions
- `src/app/(authenticated)/admin/users/page.tsx` — user management
- `src/app/(authenticated)/admin/logs/page.tsx` — activity logs

### Modified files
- `src/app/login/page.tsx` — add Remember Me checkbox
- `src/lib/supabase/client.ts` — custom storage adapter for Remember Me
- `src/lib/types/database.ts` — add super_admin role, AdminLog type
- `src/components/Header.tsx` — add Users/Logs nav for super_admin
- `src/lib/i18n/dictionaries/ar.json` — new Arabic translations
- `src/lib/i18n/dictionaries/en.json` — new English translations
- All admin CRUD pages — add `logAdminAction()` calls after mutations
- `src/app/(authenticated)/layout.tsx` — pass role info for conditional nav
