# MAINPLAN.md — Booking0Trip System

> Complete project reference. Everything we built, why, and how it works.
> Last updated: 2026-04-07

---

## What Is This

A bilingual (Arabic/English) web app for managing church trip bookings — buses, rooms, and passengers. Built for ~40 concurrent users with elderly-friendly design.

**Live routes:**
- `/login` and `/signup` — public auth
- `/trips` — patient-facing: browse trips, see passengers, book buses
- `/trips/[tripId]/buses` — patient: choose bus, see who's on it
- `/admin` — admin dashboard
- `/admin/trips` — trip CRUD with booking count per trip
- `/admin/trips/[id]` — trip detail (overview / buses / rooms / unbooked tabs)
- `/admin/users` — user management (admin+ only)
- `/admin/logs` — activity logs (super_admin only)
- `/admin/reports` — PDF generation

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 App Router, TypeScript, Tailwind CSS |
| Backend/DB | Supabase (PostgreSQL, Auth, RLS, Edge Functions) |
| Auth | Supabase email hack: `{phone}@church.local` |
| PDF | Edge Function (Deno) + client-side pdf-lib fallback |
| i18n | Custom dictionary approach (no URL prefixes) |
| Dark mode | `next-themes` with class strategy |
| Testing | Jest + React Testing Library |

---

## Roles

| Role | Admin Panel | What |
|------|:-----------:|------|
| `super_admin` | Yes | Everything + manage admins + view logs |
| `admin` | Yes | Manage trips/buses/rooms/bookings/users |
| `servant` | No | Same as patient (just a label) |
| `patient` | No | Book trips, view own bookings |
| `companion` | No | Same as patient |
| `family_assistant` | No | Same as patient |

Database-level: `is_admin()` returns true for `admin` and `super_admin` only.

---

## Database Schema

### Tables

**profiles** — User accounts (synced from auth.users via trigger)
- `id` uuid PK → auth.users(id) ON DELETE CASCADE
- `phone` text UNIQUE NOT NULL
- `full_name` text NOT NULL
- `gender` text CHECK IN ('Male','Female')
- `role` text CHECK IN ('super_admin','admin','servant','patient','companion','family_assistant')
- `has_wheelchair` boolean DEFAULT false
- `deleted_at` timestamptz (soft delete)
- `created_at` timestamptz

**trips** — Church trips
- `id` uuid PK
- `title_ar`, `title_en` text NOT NULL
- `trip_date` date NOT NULL
- `is_open` boolean DEFAULT true

**areas** — Reusable area names for buses
- `id` uuid PK
- `name_ar`, `name_en` text NOT NULL, UNIQUE(name_ar, name_en)
- `is_active` boolean DEFAULT true
- `sort_order` int DEFAULT 4

**buses** — Bus instances per trip
- `id` uuid PK
- `trip_id` uuid FK → trips(id) ON DELETE CASCADE
- `area_name_ar`, `area_name_en` text NOT NULL
- `capacity` int CHECK > 0
- `leader_name` text
- `area_id` uuid FK → areas(id) ON DELETE SET NULL
- `bus_label` text

**rooms** — Hotel rooms per trip
- `id` uuid PK
- `trip_id` uuid FK → trips(id) ON DELETE CASCADE
- `room_type` text CHECK IN ('Male','Female')
- `capacity` int CHECK > 0
- `supervisor_name` text
- `room_label` text NOT NULL

**bookings** — Passenger bookings
- `id` uuid PK
- `user_id` uuid FK → profiles(id)
- `trip_id` uuid FK → trips(id) ON DELETE CASCADE
- `bus_id` uuid FK → buses(id) ON DELETE CASCADE
- `room_id` uuid FK → rooms(id) ON DELETE SET NULL
- `created_at` timestamptz
- `cancelled_at` timestamptz (soft delete)
- UNIQUE (user_id, trip_id) WHERE cancelled_at IS NULL — one active booking per user per trip

**admin_logs** — Audit trail
- `id` uuid PK
- `admin_id` uuid FK → profiles(id)
- `action` text NOT NULL
- `target_type`, `target_id` text/uuid
- `details` jsonb DEFAULT '{}'
- `created_at` timestamptz

### Cascade Deletes (Important)

When you delete a **trip** → all its buses, rooms, and bookings are deleted automatically.

When you delete a **bus** → all bookings on that bus are deleted.

When you delete a **room** → bookings keep their row but `room_id` becomes NULL.

This is what fixed the "cannot delete trip" bug.

---

## Database Functions (RPC)

All run as `SECURITY DEFINER` with `SET search_path = ''` for security.

| Function | What | Who Can Call |
|----------|------|-------------|
| `is_admin()` | Returns true if current user is admin/super_admin and not soft-deleted | Used internally by RLS |
| `handle_new_user()` | Auto-creates profile when auth.users row is created | Trigger |
| `register_and_book(phone, name, gender, password, trip_id, bus_id, role, wheelchair)` | Creates user + profile + optional booking in one transaction | admin |
| `book_bus(user_id, trip_id, bus_id)` | Books a bus seat with capacity/trip checks | Any authenticated user |
| `assign_room(booking_id, room_id)` | Assigns room with gender+capacity validation | admin |
| `cancel_booking(booking_id)` | Soft-deletes booking (sets cancelled_at) | admin or own user |
| `get_trip_passengers(trip_id)` | Returns all active passengers for a trip | admin |
| `move_passenger_bus(booking_id, new_bus_id)` | Moves passenger to another bus (same trip, capacity check) | admin |
| `admin_create_user(phone, name, gender, password, role, wheelchair)` | Creates user with any role | admin |
| `admin_delete_user(user_id)` | Soft-deletes user (sets deleted_at) | admin |
| `admin_reset_password(user_id, new_password)` | Resets password | admin |

---

## RLS Policies

Every table has Row Level Security enabled.

- **patients**: can SELECT own profile, own bookings; INSERT own booking (if trip open)
- **admin/super_admin**: full CRUD on everything via `is_admin()` check
- **areas**: readable by all authenticated, writable by admin
- **admin_logs**: insertable and readable by admin only

---

## File Structure

```
src/
  app/
    layout.tsx                              # Root: ThemeProvider + I18nProvider + ToastProvider
    page.tsx                                # Redirect → /trips
    globals.css                             # Tailwind + component classes + dark mode
    login/page.tsx                          # Phone + password
    signup/page.tsx                         # Registration (user type + wheelchair)
    (authenticated)/
      layout.tsx                            # Auth guard + Header + MobileNav
      trips/
        page.tsx                            # Patient: list trips + passengers + book
        [tripId]/buses/page.tsx             # Patient: choose bus + see passengers
      admin/
        page.tsx                            # Dashboard with trip stats
        trips/
          page.tsx                          # Trip CRUD with booking count
          [id]/
            page.tsx                        # Trip detail hub (4 tabs)
            OverviewTab.tsx                 # Area overview + stats
            BusesTab.tsx                    # Bus CRUD + passenger list + move/remove
            RoomsTab.tsx                    # Room CRUD + assign
            UnbookedTab.tsx                 # Unbooked users + register
        users/page.tsx                      # User management (admin+)
        logs/page.tsx                       # Activity logs (super_admin)
        reports/page.tsx                    # PDF reports
  components/
    Header.tsx                              # Desktop nav
    MobileNav.tsx                           # Mobile bottom nav
    LanguageToggle.tsx                      # AR/EN
    ThemeToggle.tsx                         # Light/Dark
    LoadingSpinner.tsx
    Toast.tsx
  lib/
    supabase/
      client.ts                            # Browser client
      server.ts                            # Server client
      middleware.ts                         # Auth session + redirects
    i18n/
      context.tsx                           # I18nProvider
      useTranslation.ts                     # t() function
      dictionaries/ar.json + en.json
    pdf/generate-report.ts                 # Client-side PDF
    admin-logs.ts                           # logAction() helper
    types/database.ts                       # TypeScript interfaces
  middleware.ts                             # Next.js middleware entry

supabase/
  migrations/
    00001_initial_schema.sql               # Full schema (fresh installs)
    00002_fix_cascade_and_policies.sql     # Live DB patches + move_passenger_bus RPC
  functions/
    generate-report/index.ts               # Edge Function (Deno)

docs/superpowers/
  SYSTEM.md                                # Technical reference
  MAINPLAN.md                              # This file — everything we did
  plans/2026-04-07-consolidation-fixes.md  # Execution log
```

---

## Key Design Decisions

1. **Phone as login**: `{phone}@church.local` — Supabase Auth requires email, so we fake it
2. **Soft deletes**: Users via `deleted_at`, bookings via `cancelled_at`. Trips/buses/rooms are hard-deleted with CASCADE
3. **Servant = patient**: Servant role exists but has no special permissions (no admin panel)
4. **One active booking per user per trip**: Enforced by unique partial index
5. **Gender-separated rooms**: Room assignment validates gender match
6. **Wheelchair tracking**: `has_wheelchair` flag, shown with ♿ icon
7. **Dark mode**: `next-themes` with class strategy, toggle in header
8. **i18n**: Custom dictionary in localStorage, no URL prefixes, Arabic default
9. **Elderly-friendly**: 18px base font, 48px min buttons, simple Arabic labels, high contrast

---

## Build History

### Phase 1: Initial Build (2026-04-02 to 2026-04-03)
- Scaffolded Next.js app with Supabase
- Built auth (phone+password), profiles, trips, buses, rooms, bookings
- Patient UI: browse trips → choose bus → confirm
- Admin UI: dashboard, trip CRUD, bus/room/unbooked tabs, PDF reports
- RLS policies, RPC functions
- Added areas system, UX overhaul (مريض→مخدوم rename), admin enhancements

### Phase 2: Dark Mode + User Types (2026-04-04 to 2026-04-05)
- Added `next-themes` dark mode with sun/moon toggle
- Added user types: companion, family_assistant
- Added wheelchair tracking (`has_wheelchair`)
- Admin user management with role changes, soft delete

### Phase 3: Consolidation + Fixes (2026-04-07)
- **Bug fix**: Cannot delete trips → added `ON DELETE CASCADE` on bookings.trip_id FK
- **Bug fix**: `is_servant()` was broken → removed it, all policies use `is_admin()` directly
- **Cleanup**: Consolidated 11 messy migrations into 1 clean file
- **Feature**: Added passenger names to patient trips page
- **Feature**: Added booking count badge to admin trips list
- **Cleanup**: Deleted 15 old plan/spec files, wrote SYSTEM.md

### Phase 4: Bus Passenger Management (2026-04-07)
- **Feature**: BusesTab now shows all passengers per bus (collapsed by default)
- **Feature**: "Move to" — move passenger between buses with capacity check
- **Feature**: "Remove" — cancel passenger's entire booking with confirm dialog
- **New RPC**: `move_passenger_bus(booking_id, new_bus_id)` — validates same trip + capacity
- **i18n**: Added 12 new keys (AR + EN) for passenger management
- Wrote this MAINPLAN.md

---

## Manual Supabase Steps

After pulling code changes, you may need to run SQL in **Supabase SQL Editor**:

### Already done (Phase 3):
- `00002_fix_cascade_and_policies.sql` — FK cascades + `is_admin()` + RLS policies

### New (Phase 4):
Run this in Supabase SQL Editor to add the `move_passenger_bus` function:

```sql
CREATE OR REPLACE FUNCTION public.move_passenger_bus(
  p_booking_id uuid,
  p_new_bus_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_trip_id uuid;
  v_current_bus_id uuid;
  v_capacity int;
  v_current int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin users can move passengers';
  END IF;

  SELECT trip_id, bus_id INTO v_trip_id, v_current_bus_id
  FROM public.bookings
  WHERE id = p_booking_id AND cancelled_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found or cancelled';
  END IF;

  IF v_current_bus_id = p_new_bus_id THEN
    RAISE EXCEPTION 'Passenger is already on this bus';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.buses
    WHERE id = p_new_bus_id AND trip_id = v_trip_id
  ) THEN
    RAISE EXCEPTION 'Target bus not found or not in same trip';
  END IF;

  SELECT capacity INTO v_capacity
  FROM public.buses WHERE id = p_new_bus_id FOR UPDATE;

  SELECT COUNT(*) INTO v_current
  FROM public.bookings
  WHERE bus_id = p_new_bus_id AND cancelled_at IS NULL;

  IF v_current >= v_capacity THEN
    RAISE EXCEPTION 'Target bus is full';
  END IF;

  UPDATE public.bookings
  SET bus_id = p_new_bus_id, room_id = NULL
  WHERE id = p_booking_id;
END;
$$;
```

---

## How to Test

1. **Trip deletion**: Create trip → add bus → book someone → delete trip → should work (cascades)
2. **Bus passengers**: Go to admin → trips → manage a trip → buses tab → click "Show passengers" on any bus
3. **Move passenger**: Click "Move to" on a passenger → select target bus → confirm
4. **Remove passenger**: Click "Remove" on a passenger → confirm → booking cancelled
5. **Patient view**: Go to `/trips` → see passenger names under each trip → click to expand
6. **Dark mode**: Toggle sun/moon icon in header

---

## Known Warnings (non-blocking)

ESLint `react-hooks/exhaustive-deps` warnings on 6 pages — these are intentional (omitting `loadData` from useEffect deps to prevent infinite loops). Safe to ignore.
