# Booking0Trip System — Complete Documentation

> Single source of truth for the entire system. Last updated: 2026-04-07.

---

## 1. Overview

**Booking0Trip** is a bilingual (Arabic/English) web app for managing church trips, bus seat bookings, and room assignments. Built for ~40 concurrent users with elderly-friendly design.

**Stack:** Next.js 14 (App Router) + TypeScript + Tailwind CSS + Supabase (PostgreSQL, Auth, Edge Functions)

---

## 2. Roles & Permissions

| Role | Admin Panel | Patient UI | Description |
|------|:-----------:|:----------:|-------------|
| `super_admin` | Full access | Yes | Can manage admins, view logs, delete users |
| `admin` | Full access | Yes | Can manage trips/buses/rooms/bookings/users |
| `servant` | No | Yes | Same as patient, just a label |
| `patient` | No | Yes | Browse trips, book bus seats |
| `companion` | No | Yes | Same as patient |
| `family_assistant` | No | Yes | Same as patient |

**Database-level:** Only `admin` and `super_admin` pass `is_admin()` check used in RLS policies and RPC functions.

---

## 3. Database Schema

### 3.1 `profiles`

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid PK | References `auth.users(id)` ON DELETE CASCADE |
| phone | text | UNIQUE NOT NULL |
| full_name | text | NOT NULL |
| gender | text | NOT NULL CHECK IN ('Male','Female') |
| role | text | NOT NULL DEFAULT 'patient' CHECK IN ('super_admin','admin','servant','patient','companion','family_assistant') |
| has_wheelchair | boolean | NOT NULL DEFAULT false |
| deleted_at | timestamptz | NULL (soft delete) |
| created_at | timestamptz | DEFAULT now() |

**Indexes:** `idx_profiles_phone(phone)`, `idx_profiles_deleted_at(deleted_at) WHERE deleted_at IS NOT NULL`

### 3.2 `trips`

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid PK | gen_random_uuid() |
| title_ar | text | NOT NULL |
| title_en | text | NOT NULL |
| trip_date | date | NOT NULL |
| is_open | boolean | DEFAULT true |
| created_at | timestamptz | DEFAULT now() |

### 3.3 `buses`

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid PK | gen_random_uuid() |
| trip_id | uuid FK | → trips(id) ON DELETE CASCADE |
| area_name_ar | text | NOT NULL |
| area_name_en | text | NOT NULL |
| capacity | int | NOT NULL CHECK (capacity > 0) |
| leader_name | text | NULLABLE |
| area_id | uuid FK | → areas(id) ON DELETE SET NULL (NULLABLE) |
| bus_label | text | NULLABLE |

### 3.4 `rooms`

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid PK | gen_random_uuid() |
| trip_id | uuid FK | → trips(id) ON DELETE CASCADE |
| room_type | text | NOT NULL CHECK IN ('Male','Female') |
| capacity | int | NOT NULL CHECK (capacity > 0) |
| supervisor_name | text | NULLABLE |
| room_label | text | NOT NULL |

### 3.5 `bookings`

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid PK | gen_random_uuid() |
| user_id | uuid FK | → profiles(id) |
| trip_id | uuid FK | → trips(id) ON DELETE CASCADE |
| bus_id | uuid FK | → buses(id) ON DELETE CASCADE |
| room_id | uuid FK | → rooms(id) ON DELETE SET NULL |
| created_at | timestamptz | DEFAULT now() |
| cancelled_at | timestamptz | NULL |

**Unique Index:** `idx_bookings_unique_active(user_id, trip_id) WHERE cancelled_at IS NULL` — one active booking per user per trip.

**Indexes:** `trip_id`, `bus_id`, `room_id`, `user_id`

### 3.6 `areas`

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid PK | gen_random_uuid() |
| name_ar | text | NOT NULL |
| name_en | text | NOT NULL |
| is_active | boolean | NOT NULL DEFAULT true |
| sort_order | int | NOT NULL DEFAULT 4 |
| created_at | timestamptz | DEFAULT now() |

**Unique:** `(name_ar, name_en)`

### 3.7 `admin_logs`

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid PK | gen_random_uuid() |
| admin_id | uuid FK | → profiles(id) |
| action | text | NOT NULL |
| target_type | text | NULLABLE |
| target_id | uuid | NULLABLE |
| details | jsonb | DEFAULT '{}' |
| created_at | timestamptz | DEFAULT now() |

**Indexes:** `admin_id`, `created_at DESC`, `action`

---

## 4. Auth

- Phone + password via Supabase email hack: `{phone}@church.local`
- Trigger `on_auth_user_created` auto-inserts profile row
- No email verification (private app)
- JWT via `@supabase/ssr` cookies

---

## 5. Database Functions (RPC)

### `is_admin()` → boolean
Returns true if current user has role `admin` or `super_admin` and is not soft-deleted. Used by all RLS policies.

### `handle_new_user()` → trigger
Auto-creates profile row when auth.users row is inserted.

### `register_and_book(p_phone, p_full_name, p_gender, p_password, p_trip_id, p_bus_id, p_role, p_has_wheelchair)` → uuid
Creates auth user + profile + optional bus booking in one transaction. Admin-only.

### `book_bus(p_user_id, p_trip_id, p_bus_id)` → uuid
Books a bus seat with capacity check. Validates trip is open and user hasn't already booked.

### `assign_room(p_booking_id, p_room_id)` → void
Assigns room to booking with gender validation and capacity check.

### `cancel_booking(p_booking_id)` → void
Soft-deletes a booking (sets cancelled_at, clears room_id).

### `get_trip_passengers(p_trip_id)` → TABLE(bus_id, full_name, has_wheelchair)
Returns all active passengers for a trip.

### `admin_create_user(p_phone, p_full_name, p_gender, p_password, p_role, p_has_wheelchair)` → uuid
Creates a user with any role. Admin-only. Cannot create super_admin.

### `admin_delete_user(p_user_id)` → void
Soft-deletes a user (sets deleted_at). Cannot delete super_admin. Admin cannot delete other admins.

### `admin_reset_password(p_user_id, p_new_password)` → void
Resets a user's password. Admin-only. Cannot reset super_admin.

---

## 6. RLS Policies

| Table | Policy | Who |
|-------|--------|-----|
| profiles | SELECT own | auth.uid() = id |
| profiles | SELECT all | is_admin() |
| profiles | INSERT | is_admin() |
| profiles | UPDATE | is_admin() |
| trips | SELECT | authenticated users |
| trips | ALL | is_admin() |
| buses | SELECT | authenticated users |
| buses | ALL | is_admin() |
| rooms | SELECT | authenticated users |
| rooms | ALL | is_admin() |
| bookings | SELECT own | auth.uid() = user_id |
| bookings | SELECT all | is_admin() |
| bookings | INSERT own | auth.uid() = user_id + trip is open |
| bookings | ALL | is_admin() |
| areas | SELECT | authenticated users |
| areas | ALL | is_admin() |
| admin_logs | INSERT | is_admin() |
| admin_logs | SELECT | is_admin() |

---

## 7. File Structure

```
src/
  app/
    layout.tsx                              # Root: ThemeProvider + I18nProvider + ToastProvider
    page.tsx                                # Redirect to /trips
    globals.css                             # Tailwind + component classes + dark mode
    login/page.tsx                          # Phone + password login
    signup/page.tsx                         # Registration form
    (authenticated)/
      layout.tsx                            # Auth guard + Header + MobileNav
      trips/
        page.tsx                            # Patient: list open trips + book
        [tripId]/
          buses/page.tsx                    # Patient: choose bus + see passengers
      admin/
        page.tsx                            # Admin dashboard with trip stats
        trips/
          page.tsx                          # Trip CRUD list
          [id]/
            page.tsx                        # Trip detail hub (4 tabs)
            OverviewTab.tsx                 # Area overview + stats
            BusesTab.tsx                    # Bus CRUD + capacity
            RoomsTab.tsx                    # Room CRUD + assign
            UnbookedTab.tsx                 # Unbooked users + register
        users/page.tsx                      # User management (admin only)
        logs/page.tsx                       # Activity logs (super_admin only)
        reports/page.tsx                    # PDF report generation
  components/
    Header.tsx                              # Desktop nav with role-based links
    MobileNav.tsx                           # Mobile bottom nav
    LanguageToggle.tsx                      # AR/EN toggle
    ThemeToggle.tsx                         # Light/Dark toggle
    LoadingSpinner.tsx                      # Reusable spinner
    Toast.tsx                               # Toast notifications
  lib/
    supabase/
      client.ts                            # Browser Supabase client
      server.ts                            # Server Supabase client
      middleware.ts                         # Auth session refresh + redirects
    i18n/
      context.tsx                           # I18nProvider
      useTranslation.ts                     # t() function
      dictionaries/
        ar.json                             # Arabic translations
        en.json                             # English translations
    pdf/
      generate-report.ts                   # Client-side PDF generation
    admin-logs.ts                           # logAction() helper
    types/
      database.ts                           # TypeScript interfaces
  middleware.ts                             # Next.js middleware entry

supabase/
  config.toml
  migrations/
    00001_initial_schema.sql               # Single consolidated migration
  functions/
    generate-report/index.ts               # Edge Function (Deno) for PDF reports
```

---

## 8. Page Routes

| Route | Who | Purpose |
|-------|-----|---------|
| `/login` | Public | Phone + password login |
| `/signup` | Public | Registration |
| `/trips` | All authenticated | List open trips, see passengers, book |
| `/trips/[tripId]/buses` | All authenticated | Choose bus, see who's on it |
| `/admin` | admin, super_admin | Dashboard with stats |
| `/admin/trips` | admin, super_admin | Trip CRUD |
| `/admin/trips/[id]` | admin, super_admin | Trip detail (overview/buses/rooms/unbooked tabs) |
| `/admin/users` | admin, super_admin | User management |
| `/admin/logs` | super_admin | Activity logs |
| `/admin/reports` | admin, super_admin | PDF reports |

---

## 9. Key Design Decisions

1. **Phone as login**: Uses `{phone}@church.local` email hack since Supabase Auth requires email
2. **Soft deletes**: Users are soft-deleted via `deleted_at`. Bookings are soft-deleted via `cancelled_at`. Trips/buses/rooms are hard-deleted with CASCADE.
3. **No servant admin access**: `is_admin()` only checks for `admin` or `super_admin`. Servant role exists but has no special permissions.
4. **One active booking per user per trip**: Enforced by unique partial index
5. **Gender-separated rooms**: Room assignment validates gender match
6. **Wheelchair tracking**: `has_wheelchair` flag on profiles, shown with ♿ icon
7. **Dark mode**: Via `next-themes` with class strategy, toggle in header
8. **i18n**: Custom dictionary approach, stored in localStorage, no URL prefixes
9. **Elderly-friendly**: 18px base font, 48px min button height, simple Arabic labels

---

## 10. Bugs Fixed (2026-04-07)

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| Cannot delete trips | `bookings.trip_id` FK had no ON DELETE CASCADE | Added `ON DELETE CASCADE` |
| `is_servant()` was broken | It just called `is_admin()`, confusing | Removed `is_servant()`, all policies use `is_admin()` directly |
| 11 duplicate migrations | Functions defined 2-3 times across files | Consolidated to single migration |
| No passenger names in trips | Patient trips page had no name display | Added passenger list using `get_trip_passengers` RPC |
