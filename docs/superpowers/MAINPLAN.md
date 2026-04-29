# MAINPLAN.md — Booking0Trip System

> Complete project reference. Everything we built, why, and how it works.
> Last updated: 2026-04-29 (Phase 13 — Arabic Typo Fixes + Phone 11-Digit Limit)

---

## What Is This

A bilingual (Arabic/English) web app for managing church trip bookings — buses, rooms, and passengers. Built for ~40 concurrent users with elderly-friendly design.

**Live routes:**
- `/login` and `/signup` — public auth (with sector selection on signup)
- `/settings` — user settings (name/phone/password, sector, transport, car settings for servants)
- `/trips` — patient-facing: browse trips, see passengers, book buses, book trip-only (no bus)
- `/trips/[tripId]/buses` — patient: choose bus / "I'm driving" / "Book without bus" + see who's on it
- `/admin` — admin dashboard
- `/admin/trips` — trip CRUD with booking count per trip
- `/admin/trips/[id]` — trip detail (overview / buses / rooms / cars / unbooked tabs)
- `/admin/sectors` — sector CRUD
- `/admin/users` — user management (admin+), car settings for servants, family member management
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
| `servant` | No | Same as patient + can register car and drive passengers |
| `patient` | No | Book trips, view own bookings |
| `companion` | No | Same as patient |
| `family_assistant` | No | Same as patient |
| `trainee` | No | Same as patient — training status |

Database-level: `is_admin()` returns true for `admin` and `super_admin` only.

---

## Database Schema

### Tables

**profiles** — User accounts (synced from auth.users via trigger)
- `id` uuid PK → auth.users(id) ON DELETE CASCADE
- `phone` text UNIQUE NOT NULL
- `full_name` text NOT NULL
- `gender` text CHECK IN ('Male','Female')
- `role` text CHECK IN ('super_admin','admin','servant','patient','companion','family_assistant','trainee')
- `has_wheelchair` boolean DEFAULT false
- `sector_id` uuid FK → sectors(id) ON DELETE SET NULL
- `transport_type` text CHECK IN ('private','bus') DEFAULT 'bus'
- `servants_needed` int CHECK IN (0,1,2) DEFAULT 0
- `has_car` boolean DEFAULT false
- `car_seats` int (nullable, CHECK > 0 when set)
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
- `user_id` uuid FK → profiles(id) ON DELETE CASCADE
- `trip_id` uuid FK → trips(id) ON DELETE CASCADE
- `bus_id` uuid FK → buses(id) ON DELETE CASCADE (nullable — car passengers have no bus)
- `room_id` uuid FK → rooms(id) ON DELETE SET NULL
- `car_id` uuid FK → cars(id) ON DELETE SET NULL
- `family_member_id` uuid FK → family_members(id) ON DELETE CASCADE (nullable — head's own booking)
- `created_at` timestamptz
- `cancelled_at` timestamptz (soft delete)
- Two partial unique indexes:
  - `(user_id, trip_id) WHERE cancelled_at IS NULL AND family_member_id IS NULL` — one head booking per trip
  - `(user_id, trip_id, family_member_id) WHERE cancelled_at IS NULL AND family_member_id IS NOT NULL` — one booking per family member per trip

**family_members** — Lightweight sub-profiles (no auth account)
- `id` uuid PK
- `head_user_id` uuid FK → profiles(id) ON DELETE CASCADE
- `full_name` text NOT NULL
- `gender` text CHECK IN ('Male','Female')
- `has_wheelchair` boolean DEFAULT false
- `created_at` timestamptz

**sectors** — Church sectors/areas
- `id` uuid PK
- `name` text NOT NULL
- `code` text NOT NULL UNIQUE
- `is_active` boolean DEFAULT true
- `sort_order` int DEFAULT 0

**cars** — Servant cars per trip
- `id` uuid PK
- `trip_id` uuid FK → trips(id) ON DELETE CASCADE
- `driver_id` uuid FK → profiles(id) ON DELETE SET NULL
- `capacity` int CHECK > 0
- `car_label` text
- `created_at` timestamptz

**admin_logs** — Audit trail
- `id` uuid PK
- `admin_id` uuid FK → profiles(id) ON DELETE CASCADE
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
| `register_and_book(phone, name, gender, password, trip_id, bus_id, role, wheelchair, sector_id)` | Creates user + profile + optional booking in one transaction | admin |
| `book_bus(user_id, trip_id, bus_id)` | Books a bus seat with capacity/trip checks | Any authenticated user |
| `assign_room(booking_id, room_id)` | Assigns room with gender+capacity validation | admin |
| `cancel_booking(booking_id)` | Cancels booking + deletes car if driver | admin or own user |
| `get_trip_passengers(trip_id)` | Returns all active passengers for a trip with sector_name + gender | admin |
| `move_passenger_bus(booking_id, new_bus_id)` | Moves passenger to another bus (same trip, capacity check) | admin |
| `admin_create_user(phone, name, gender, password, role, wheelchair, sector_id)` | Creates user with any role | admin |
| `admin_delete_user(user_id)` | Hard deletes user (auth + profile + bookings) | admin |
| `admin_reset_password(user_id, new_password)` | Resets password | admin |
| `get_sectors()` | Returns all sectors ordered by sort_order | authenticated |
| `update_own_sector(sector_id)` | User updates their own sector | authenticated |
| `update_own_car_settings(has_car, car_seats)` | Servant updates their car settings | authenticated |
| `admin_update_car_settings(user_id, has_car, car_seats)` | Admin updates any servant's car settings | admin |
| `book_with_car(trip_id)` | Servant creates car + booking in one step | servant with has_car |
| `assign_car_passenger(booking_id, car_id)` | Admin assigns passenger to car | admin |
| `remove_car(car_id)` | Admin removes car from trip | admin |
| `admin_create_car(trip_id, driver_id, capacity)` | Admin manually creates car | admin |
| `add_family_member(head_user_id, full_name, gender, has_wheelchair)` | Adds a family member under a head user | admin or own user |
| `update_family_member(member_id, full_name, gender, has_wheelchair)` | Edits a family member's details | admin or own user |
| `remove_family_member(member_id)` | Removes member + cancels their bookings (CASCADE) | admin or own user |
| `get_family_members(user_id)` | Lists all family members for a user | admin or own user |
| `book_bus_with_family(user_id, trip_id, bus_id, family_member_ids[])` | Books head + selected family members on same bus in one transaction | admin or own user |
| `update_own_name(name)` | User changes own full_name | authenticated |
| `update_own_phone(phone)` | User changes own phone + auth email | authenticated |
| `update_own_transport(transport_type, servants_needed)` | User changes transport fields | authenticated |
| `update_own_password(new_password)` | User changes own password | authenticated |
| `admin_get_user_details(user_id)` | Full profile for admin modal | admin |
| `book_trip_only_with_family(user_id, trip_id, family_member_ids[])` | Books head + family on trip without bus/car | admin or own user |
| `get_all_trips_stats()` | Returns JSONB array of all trips with full stats | admin |

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
    signup/page.tsx                         # Registration (user type + sector + wheelchair + transport + servants)
    (authenticated)/
      layout.tsx                            # Auth guard + Header + MobileNav
      settings/page.tsx                     # Account settings (name/phone/password + transport + sector + car)
      trips/
        page.tsx                            # Patient: list trips + passengers + book
        [tripId]/buses/page.tsx             # Patient: choose bus / "I'm driving" + see passengers
      admin/
        page.tsx                            # Dashboard with trip stats
        sectors/page.tsx                    # Sector CRUD
        trips/
          page.tsx                          # Trip CRUD with booking count
          [id]/
            page.tsx                        # Trip detail hub (5 tabs)
            OverviewTab.tsx                 # Area overview + stats
            BusesTab.tsx                    # Bus CRUD + passenger list + move/remove
            RoomsTab.tsx                    # Room CRUD + assign
            CarsTab.tsx                     # Car management (create, assign, remove)
            UnbookedTab.tsx                 # Unbooked users + register + sector filter
        users/
          page.tsx                          # User management (admin+) + car settings
          UserDetailModal.tsx               # User detail modal (admin popup)
        logs/page.tsx                       # Activity logs (super_admin)
        reports/page.tsx                    # PDF reports
  components/
    Header.tsx                              # Desktop nav (sectors + settings links)
    MobileNav.tsx                           # Mobile bottom nav (sectors + settings tabs)
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
    constants.ts                            # Shared constants
    booking.ts                              # Shared booking utilities (bookTripOnly, toggleInSet)
  middleware.ts                             # Next.js middleware entry

supabase/
  migrations/
    00001_initial_schema.sql               # Full schema (fresh installs)
    00002_fix_cascade_and_policies.sql     # Live DB patches + move_passenger_bus RPC
    00003_add_rpc_functions.sql            # All RPC functions
    00004_part1_infrastructure.sql         # Sectors table + seed + schema changes
    00004_part2_functions.sql              # Updated RPCs with sector support
    00006_part1_cars_schema.sql            # Cars table + profile has_car + bookings.car_id
    00006_part2_cars_functions.sql         # Car RPCs + updated cancel_booking
    00007_hard_delete_user.sql             # Hard delete instead of soft delete
    00008_fix_user_delete_cascade.sql      # FK cascade fix for bookings + admin_logs
    00009_family_members.sql               # Family members table + bookings.family_member_id + all RPCs
    00009_user_profile_enhancements.sql    # transport_type + servants_needed + trainee + self-service RPCs
    00100_trip_only_and_dashboard.sql      # Trip-only booking RPC + advanced dashboard stats RPC + partial index
  functions/
    generate-report/index.ts               # Edge Function (Deno)

docs/superpowers/
  SYSTEM.md                                # Technical reference
  MAINPLAN.md                              # This file — everything we did
```

---

## Key Design Decisions

1. **Phone as login**: `{phone}@church.local` — Supabase Auth requires email, so we fake it
2. **Hard deletes for users**: Admin delete removes auth account + profile + bookings completely, freeing the phone number
3. **Soft deletes for bookings**: `cancelled_at` on bookings. Trips/buses/rooms are hard-deleted with CASCADE
4. **Servant = patient with car**: Servant role can register a car and drive patients, no admin panel access
5. **One active booking per user per trip**: Enforced by unique partial index
6. **Gender-separated rooms**: Room assignment validates gender match
7. **Wheelchair tracking**: `has_wheelchair` flag, shown with ♿ icon
8. **Sectors**: Optional sector/area assignment for users, displayed as badges
9. **Dark mode**: `next-themes` with class strategy, toggle in header
10. **i18n**: Custom dictionary in localStorage, no URL prefixes, Arabic default
11. **Elderly-friendly**: 18px base font, 48px min buttons, simple Arabic labels, high contrast
12. **Family members**: Lightweight sub-profiles (no auth account) linked to a head user. Kids/helpers who can't use phones are managed under the head's account. Head books everyone on the same bus. Cancelling head's booking cancels all family member bookings too.
13. **Trip-only booking**: Users can book a trip without choosing a bus or car — `bus_id` and `car_id` are both NULL. Transport can be decided later by admin.
14. **Dashboard efficiency**: Single `get_all_trips_stats()` RPC using `CROSS JOIN LATERAL` with correlated subqueries returns all stats in one database round-trip.

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

### Phase 5: Fix Missing RPC Functions (2026-04-07)
- **Bug**: `"No API key found in request"` error when trying to add users or do anything
- **Root cause**: Old migration files were deleted from codebase, but the live database still had the old functions. When we ran `00002_fix_cascade_and_policies.sql`, it only fixed FKs and policies — it did NOT recreate the RPC functions that the frontend depends on.
- **Fix**: Created `00003_add_rpc_functions.sql` with ALL 10 RPC functions:
  - `handle_new_user()` + trigger
  - `register_and_book()`
  - `book_bus()`
  - `assign_room()`
  - `cancel_booking()`
  - `get_trip_passengers()`
  - `move_passenger_bus()`
  - `admin_create_user()`
  - `admin_delete_user()`
  - `admin_reset_password()`

---

## Manual Supabase Steps

**CRITICAL**: You must run these SQL files in Supabase SQL Editor in order:

### Step 1: `00002_fix_cascade_and_policies.sql` (Phase 3)
- Fixes FK cascades (trip deletion bug)
- Fixes `is_admin()` function
- Recreates RLS policies

### Step 2: `00003_add_rpc_functions.sql` (Phase 5)
- Adds all RPC functions the frontend needs

### Step 3: `00004_part1_infrastructure.sql` then `00004_part2_functions.sql` (Phase 8A)
- Sectors table + seed data + sector_id on profiles
- Updated RPCs with sector support
- **Already deployed**

### Step 4: `00006_part1_cars_schema.sql` then `00006_part2_cars_functions.sql` (Phase 8D)
- Cars table, profile has_car, bookings.car_id
- Car RPCs + updated cancel_booking

### Step 5: `00007_hard_delete_user.sql` (Phase 8E)
- Hard delete instead of soft delete

### Step 6: `00008_fix_user_delete_cascade.sql` (Phase 8E)
- FK cascade fix so hard delete works

### Step 7: `00009_family_members.sql` (Phase 9)
- Family members table + bookings.family_member_id + 5 new RPCs + 4 updated RPCs

### Step 8: `00009_user_profile_enhancements.sql` (Phase 9)
- transport_type + servants_needed + trainee role + 5 self-service RPCs

### Step 9: `00100_trip_only_and_dashboard.sql` (Phase 10)
- Trip-only booking RPC + advanced dashboard stats RPC + partial index

### How to run:
1. Open **Supabase Dashboard → SQL Editor**
2. Copy the entire contents of the SQL file
3. Paste and click **Run**
4. Verify: Go to **Database → Functions** in Supabase dashboard

---

## How to Test

1. **Trip deletion**: Create trip → add bus → book someone → delete trip → should work (cascades)
2. **Bus passengers**: Go to admin → trips → manage a trip → buses tab → click "Show passengers" on any bus
3. **Move passenger**: Click "Move to" on a passenger → select target bus → confirm
4. **Remove passenger**: Click "Remove" on a passenger → confirm → booking cancelled
5. **Patient view**: Go to `/trips` → see passenger names under each trip → click to expand
6. **Dark mode**: Toggle sun/moon icon in header

---

## Phase 6: Code Quality Audit + Security Fixes (2026-04-17)

### Security Fixes (CRITICAL — requires running `00003_add_rpc_functions.sql` on live DB)

- **`book_bus()` RPC**: Added `is_admin() OR auth.uid() = p_user_id` check — any authenticated user can no longer book buses on behalf of other users
- **`cancel_booking()` RPC**: Added ownership check (`is_admin() OR auth.uid() = booking_owner`) — any authenticated user can no longer cancel others' bookings
- **`assign_room()` RPC**: Added `is_admin()` check — any authenticated user can no longer assign rooms
- Applied to both `00001_initial_schema.sql` and `00003_add_rpc_functions.sql`

### Error Handling

- Wrapped all `loadData()`/`loadBuses()`/`loadTrips()`/`loadUsers()`/`loadLogs()` functions with try/catch in 11 files
- Added error state + retry button to `OverviewTab`
- All other pages show toast or gracefully degrade on failure
- Files changed: `OverviewTab`, `BusesTab`, `RoomsTab`, `UnbookedTab`, `trips/page.tsx`, `trips/[tripId]/buses/page.tsx`, `admin/page.tsx`, `admin/trips/page.tsx`, `admin/trips/[id]/page.tsx`, `admin/users/page.tsx`, `admin/logs/page.tsx`, `admin/reports/page.tsx`

### ESLint Fixes (0 warnings now — was 6)

- Replaced `useEffect` with inline functions + `eslint-disable` comments with `useCallback` pattern
- All `loadData` functions are now stable `useCallback` references passed to `useEffect`
- All dependency arrays include stable references (`supabase`, `showToast`, `t`)

### TypeScript Fixes (0 errors now — was 16 in tests)

- Installed missing `@testing-library/dom` peer dependency
- Added explicit `HTMLElement` type annotations to `.find()` callbacks in `login.test.tsx` and `signup.test.tsx`

### Accessibility

- Added `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, `role="tabpanel"` to admin trip detail tabs
- Added `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax` to bus capacity bars

### New Files

- `src/lib/constants.ts` — shared constants (`PHONE_REGEX`, `PASSWORD_MIN_LENGTH`, `PAGE_SIZE_*`, `TOAST_DURATION_MS`, `DEBOUNCE_MS`, etc.)

### Other Fixes

- Toast cleanup: added `clearTimeout` return to prevent state updates on unmounted components

### Commit

`e91c497` — fix: security, error handling, ESLint, and accessibility improvements

---

## Coding Conventions (follow these in all future work)

### Data Loading Pattern

All page data loading functions MUST use this pattern:

```tsx
const loadData = useCallback(async () => {
  try {
    // fetch data
  } catch {
    showToast(t("common.error"), "error");
  } finally {
    setLoading(false);
  }
}, [tripId, supabase, showToast, t]);

useEffect(() => {
  loadData();
}, [loadData]);
```

- NEVER use `// eslint-disable-next-line react-hooks/exhaustive-deps`
- NEVER use inline async functions inside `useEffect`
- ALWAYS wrap data fetching in try/catch
- ALWAYS include stable deps in useCallback array

### Shared Constants

Use `src/lib/constants.ts` for:
- `PHONE_REGEX`, `PASSWORD_MIN_LENGTH` — validation
- `PAGE_SIZE_USERS`, `PAGE_SIZE_LOGS`, `PAGE_SIZE_UNBOOKED` — pagination
- `TOAST_DURATION_MS`, `DEBOUNCE_MS` — timeouts

### Type Safety

- NEVER use implicit `any` — always annotate callback parameters
- Prefer proper types over `as unknown as` casts (future: generate Supabase types)

### SQL / RPC Functions

- ALL `SECURITY DEFINER` functions MUST check authorization (`is_admin()` or `auth.uid()` ownership)
- NEVER trust that RLS alone protects `SECURITY DEFINER` functions (they bypass RLS)

### Accessibility

- Tab interfaces MUST have `role="tablist"`, `role="tab"`, `aria-selected`
- Progress bars MUST have `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`

---

## Phase 7: Mobile-Friendly Auth UX (2026-04-17)

### Login & Signup — Numbers-Only Phone Input

- Phone input now forces numeric keypad on mobile: `inputMode="numeric"` + `pattern="[0-9]*"`
- `handlePhoneChange()` strips all non-digit characters and caps at 15 digits — no spaces or letters possible
- Phone displayed in centered monospace font (`text-xl tracking-widest font-mono`) for easy readability
- Used `PHONE_REGEX` and `PASSWORD_MIN_LENGTH` from `constants.ts` instead of inline regex/numbers

### Mobile UX Improvements

- All inputs centered with larger text for easy thumb-typing
- Helper hint text below phone field ("اكتب رقمك من غير مسافات" / "Enter numbers only, no spaces")
- Helper hint text below password field ("6 حروف على الأقل" / "At least 6 characters")
- Larger checkbox (20px) for "Remember Me" with `text-base` label
- Larger wheelchair toggle (28x48px) with `text-base` label
- User type buttons use `grid grid-cols-3` for even sizing on small screens
- Removed `hover:` states on selection buttons, replaced with `active:` for touch feedback
- Reduced form spacing from `space-y-5` to `space-y-4` on signup to fit more on small screens
- Added `gap-2` between Theme/Language toggles

### New i18n Keys

- `auth.phoneHint` — "اكتب رقمك من غير مسافات" / "Enter numbers only, no spaces"
- `auth.passwordHint` — "6 حروف على الأقل" / "At least 6 characters"

### Files Changed

- `src/app/login/page.tsx`
- `src/app/signup/page.tsx`
- `src/lib/i18n/dictionaries/ar.json`
- `src/lib/i18n/dictionaries/en.json`

### Servant Role on Signup

- Added `servant` to signup role options alongside patient, companion, and family_assistant
- Changed role grid from 3-col to 2x2 grid for better mobile layout with 4 options
- Servant has same permissions as patient (no admin panel access) — it's just a label in the system
- Database already accepted servant — no migration needed

---

## Known Warnings (non-blocking)

None — 0 ESLint warnings, 0 TypeScript errors as of Phase 8.

---

## Phase 8: Sectors, Settings, Cars, Hard Delete (2026-04-20)

### Phase 8A: Sectors Foundation

- **New `sectors` table** with 16 Arabic sector names (كنيسة مارجرجس, كنيسة العذراء, etc.)
- **`sector_id` (nullable FK)** added to `profiles`
- **Signup**: required sector dropdown
- **Admin**: new `/admin/sectors` CRUD page (list, add, edit, toggle active)
- **Admin users page**: sector column + sector filter + sector in create form
- **Updated RPCs**: `handle_new_user`, `register_and_book`, `admin_create_user`, `get_trip_passengers` (now returns `sector_name` + `gender`)
- **New RPCs**: `get_sectors`, `update_own_sector`

### Phase 8B: Settings + Sector Self-Service

- **New `/settings` page**: sector self-change for all users, car settings for servants only
- **Navigation**: settings link in Header + MobileNav for all users
- **Sector badge** displayed on passenger names across all views (patient trips, bus selection, BusesTab, UnbookedTab)
- **Sector filter** in UnbookedTab and admin users page

### Phase 8C: Companions — REMOVED

- Originally added `companion_count` on bookings and seats-based capacity formula
- **Removed** per user request — capacity is back to simple passenger count (`COUNT(*)`)
- All companion UI inputs, i18n keys, types, and SQL migrations deleted

### Phase 8D: Cars (Servants Driving Patients)

- **`has_car` boolean + `car_seats` int** on `profiles`
- **New `cars` table** (separate from buses, `ON DELETE SET NULL` for bookings)
- **`bookings.bus_id`** made nullable, **`bookings.car_id`** added
- **New RPCs**: `update_own_car_settings`, `admin_update_car_settings`, `book_with_car`, `assign_car_passenger`, `remove_car`, `admin_create_car`
- **Updated `cancel_booking`**: when driver cancels, their car is deleted too
- **Settings page**: car toggle + seats input (servants only)
- **CarsTab**: admin can create cars, assign passengers, remove cars
- **Bus selection page**: "I'm driving" card for servants with `has_car=true`
- **Admin users page**: inline car settings for servant profiles (🚗 badge + edit form)

### Phase 8E: Hard Delete Users + FK Cascade Fix

- Changed `admin_delete_user` from soft delete (`deleted_at`) to **hard delete**:
  1. Deletes all user's bookings
  2. Deletes the profile
  3. Deletes the `auth.users` record (frees the phone number)
- Fixed FK cascades on `bookings.user_id` and `admin_logs.admin_id` to `ON DELETE CASCADE` — was missing, causing "Database error deleting user" in Supabase dashboard

### SQL Migrations (run in order)

| File | Status | What |
|------|--------|------|
| `00004_part1_infrastructure.sql` | Deployed | Sectors table + seed + sector_id column + RLS |
| `00004_part2_functions.sql` | Deployed | Updated RPCs with sector support |
| `00006_part1_cars_schema.sql` | Deployed | Cars table + profile has_car + bookings.car_id |
| `00006_part2_cars_functions.sql` | Deployed | Car RPCs + updated cancel_booking |
| `00007_hard_delete_user.sql` | Deployed | Hard delete instead of soft delete |
| `00008_fix_user_delete_cascade.sql` | Deployed | FK cascade fix for bookings + admin_logs |
| `00009_user_profile_enhancements.sql` | Deployed | transport_type + servants_needed + trainee role + 5 RPCs + updated RPCs |

### Key Files Added

- `src/app/(authenticated)/admin/sectors/page.tsx` — sector CRUD
- `src/app/(authenticated)/settings/page.tsx` — sector self-change + car settings
- `src/app/(authenticated)/admin/trips/[id]/CarsTab.tsx` — car management per trip

### Key Files Modified

- `src/lib/types/database.ts` — `Sector`, `Car` types; `Profile` has `sector_id`, `has_car`, `car_seats`; `Booking` has `car_id`, nullable `bus_id`
- `src/lib/i18n/dictionaries/ar.json` + `en.json` — sectors, settings, cars sections
- `src/components/Header.tsx` + `MobileNav.tsx` — sectors + settings navigation
- `src/app/signup/page.tsx` — sector dropdown
- `src/app/(authenticated)/admin/users/page.tsx` — sector column, filter, car settings
- `src/app/(authenticated)/trips/[tripId]/buses/page.tsx` — "I'm driving" for servants
- `src/app/(authenticated)/admin/trips/[id]/page.tsx` — 5 tabs (overview/buses/rooms/cars/unbooked)

---

## Phase 9: Family Members (2026-04-22)

### Problem

Some patients have family members (kids, helpers, elderly) who cannot create their own accounts — they can't use phones. They all belong to one phone number (the "head of family"). Previously, each person needed a separate account.

### Solution

A **`family_members`** table with lightweight sub-profiles (no auth account) linked to a head user. Each family member gets their own booking row when the head books a trip.

### Database Changes

- **New `family_members` table** with RLS (head can manage own, admin can manage all)
- **`bookings.family_member_id`** added (nullable FK with CASCADE)
- **Two partial unique indexes** replace the old single unique index:
  - Head: `(user_id, trip_id) WHERE family_member_id IS NULL AND cancelled_at IS NULL`
  - Family: `(user_id, trip_id, family_member_id) WHERE family_member_id IS NOT NULL AND cancelled_at IS NULL`

### New RPCs (5)

| RPC | What |
|-----|------|
| `add_family_member` | Add member under head (admin or self) |
| `update_family_member` | Edit member details |
| `remove_family_member` | Remove member (CASCADE deletes their bookings) |
| `get_family_members` | List all members for a user |
| `book_bus_with_family` | Book head + selected members on same bus in one transaction |

### Updated RPCs (4)

| RPC | Change |
|-----|--------|
| `get_trip_passengers` | Returns `family_member_id` + `head_user_id` for grouping; uses `COALESCE(fm.gender, p.gender)` |
| `cancel_booking` | When head's own booking is cancelled (family_member_id IS NULL), also cancels all family member bookings for that trip |
| `assign_room` | Uses family member's gender (not head's) when `family_member_id` is set |
| `book_bus` | Duplicate check now only looks at head bookings (`family_member_id IS NULL`) |

### UI Changes

- **Settings page**: Family Members section with add/edit/remove. Shows numbered list with gender + wheelchair badges.
- **Bus selection page**: Purple "Select who's coming" card with toggleable member buttons. Shows total people count. Calls `book_bus_with_family`.
- **Admin Users page**: Family count badge (👨‍👩‍👧 N) per user. Expandable family management section with full CRUD.
- **Admin UnbookedTab**: When booking a user, shows their family member toggles. Uses `book_bus_with_family`. Only counts head bookings as "booked".
- **BusesTab**: Shows `↳` prefix for family member passengers.
- **Trips page**: Shows `↳` prefix for family members in passenger list. "My Bookings" shows family member name with `↳ Name`.
- **Confirmation page**: Shows total people booked when > 1.

### Cancel Behavior

- **Head cancels own booking** → all family member bookings for that trip also cancelled (database-level in `cancel_booking` RPC)
- **Admin cancels individual family member** → only that member's booking cancelled
- **Admin cancels head** → same as head cancelling (all family cancelled)

### SQL Migration

| File | What |
|------|------|
| `00009_family_members.sql` | Everything: table + column + indexes + RLS + 5 new RPCs + 4 updated RPCs |

### Files Changed

- `supabase/migrations/00009_family_members.sql` — new
- `src/lib/types/database.ts` — `FamilyMember` type + `Booking.family_member_id`
- `src/lib/i18n/dictionaries/ar.json` + `en.json` — `family.*` keys
- `src/app/(authenticated)/settings/page.tsx` — family members section
- `src/app/(authenticated)/trips/[tripId]/buses/page.tsx` — family member selection
- `src/app/(authenticated)/trips/page.tsx` — family member display + booking grouping
- `src/app/(authenticated)/admin/users/page.tsx` — family count badge + inline management
- `src/app/(authenticated)/admin/trips/[id]/UnbookedTab.tsx` — family member booking
- `src/app/(authenticated)/admin/trips/[id]/BusesTab.tsx` — family member indicator

---

## Phase 9: User Settings, Patient Details & Admin User Modal (2026-04-22)

### What Changed

Three major features delivered together:

1. **User self-service settings** — All users can now change their own name, phone, and password
2. **Patient profile fields** — New `transport_type` (private/bus) and `servants_needed` (0/1/2) fields collected at signup and editable in settings
3. **Admin user detail modal** — Click "Details" button next to any user to see their full profile in a popup

### Database Changes (00009_user_profile_enhancements.sql)

**New columns on `profiles`:**
- `transport_type text NOT NULL DEFAULT 'bus' CHECK IN ('private', 'bus')`
- `servants_needed int NOT NULL DEFAULT 0 CHECK IN (0, 1, 2)`

**New role:** `trainee` added to role CHECK constraint (same permissions as patient)

**New RPC functions (5):**
| Function | Purpose |
|----------|---------|
| `update_own_name(p_name)` | Change own full_name |
| `update_own_phone(p_phone)` | Change phone + auth email atomically |
| `update_own_transport(p_transport_type, p_servants_needed)` | Change transport fields |
| `update_own_password(p_new_password)` | Change own password |
| `admin_get_user_details(p_user_id)` | Full profile for admin modal |

**Updated RPC functions (3):**
| Function | Change |
|----------|--------|
| `handle_new_user()` | Extracts `transport_type` and `servants_needed` from metadata |
| `register_and_book()` | New params `p_transport_type`, `p_servants_needed`; added `trainee` to allowed roles |
| `admin_create_user()` | New params `p_transport_type`, `p_servants_needed`; added `trainee` to allowed roles |

### Frontend Changes

**Signup page** (`src/app/signup/page.tsx`):
- Added `trainee` as 5th role option (flex-wrap 3+2 grid layout)
- Added transport type toggle (ملاكى / اتوبيس)
- Added servants needed selector (0 / 1 / 2)
- New fields passed in `options.data` to `supabase.auth.signUp()`

**Settings page** (`src/app/(authenticated)/settings/page.tsx`) — major rewrite:
- Reorganized into 3 card groups: Account, Trip Details, Car (servants only)
- Account group: change name, change phone, change password (with current password verification)
- Trip Details group: transport type toggle, servants needed selector, sector dropdown
- All self-service edits go through RPC functions (SECURITY DEFINER)
- Password change verifies current password via `signInWithPassword` before updating

**Admin users page** (`src/app/(authenticated)/admin/users/page.tsx`):
- Added "Details" (تفاصيل) button next to every user row
- Added `trainee` to ALL_ROLES and CREATABLE_ROLES
- Added transport type and servants needed to create user form
- New `trainee` role badge color: orange

**New component** (`src/app/(authenticated)/admin/users/UserDetailModal.tsx`):
- Modal showing full user profile: name, phone, gender, role, wheelchair, transport type, servants needed, sector, car info
- Dark overlay with close-on-click-outside and ESC key support
- Data fetched via `admin_get_user_details` RPC

**Navigation** (`Header.tsx` + `MobileNav.tsx`):
- Admins now see Settings link in desktop header nav
- Admins now see Settings tab in mobile bottom nav
- Added settings gear icon in mobile header (top-right) for all users

**Types** (`src/lib/types/database.ts`):
- `Profile` type: added `transport_type: "private" | "bus"`, `servants_needed: 0 | 1 | 2`, `'trainee'` to role union
- New `UserDetail` type for admin modal data

### New i18n Keys (~30 keys per language)

- `auth.trainee`, `auth.transportType`, `auth.transportPrivate`, `auth.transportBus`, `auth.servantsNeeded`, `auth.transportRequired`
- `settings.accountGroup`, `settings.tripDetailsGroup`, `settings.changeName/Phone/Password`, `settings.newName/Phone`, `settings.currentPassword`, `settings.newPasswordLabel`, `settings.nameUpdated/phoneUpdated/passwordUpdated/wrongPassword`, `settings.transportType/Private/Bus`, `settings.servantsNeeded`, `settings.transportUpdated`
- `admin.trainee`, `admin.viewDetails`, `admin.userDetails`, `admin.transportType/Private/Bus`, `admin.servantsNeeded`

### Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/00009_user_profile_enhancements.sql` | New migration |
| `src/lib/types/database.ts` | Profile + UserDetail types |
| `src/lib/i18n/dictionaries/ar.json` | ~30 new keys |
| `src/lib/i18n/dictionaries/en.json` | ~30 new keys |
| `src/app/signup/page.tsx` | Trainee + transport + servants |
| `src/app/(authenticated)/settings/page.tsx` | Major rewrite (3-group layout) |
| `src/app/(authenticated)/admin/users/page.tsx` | Info button + trainee + new fields |
| `src/app/(authenticated)/admin/users/UserDetailModal.tsx` | New component |
| `src/components/Header.tsx` | Settings link for admins + gear icon |
| `src/components/MobileNav.tsx` | Settings tab for admins |

---

## Phase 10: Trip-Only Booking + Advanced Dashboard (2026-04-23)

### Problem

1. Some users want to book a trip without choosing a bus or car immediately (decide transport later)
2. Admin dashboard was minimal — no per-trip breakdowns, no role/gender/transport/sector stats, no wheelchair or servant tracking
3. Previous dashboard used multiple client-side queries instead of a single efficient RPC

### Solution

1. **Trip-only booking**: New RPC + UI for booking a trip (with family members) without selecting a bus or car
2. **Advanced dashboard**: Single `get_all_trips_stats()` RPC returning all stats in one call, with expandable per-trip cards

### Database Changes (00100_trip_only_and_dashboard.sql)

**New RPC functions (2):**

| Function | Purpose |
|----------|---------|
| `book_trip_only_with_family(p_user_id, p_trip_id, p_family_member_ids[])` | Books head + selected family members on a trip without bus or car. Returns booking ID. |
| `get_all_trips_stats()` | Returns JSONB array of all trips with full stats breakdown (admin only) |

**`book_trip_only_with_family` details:**
- Creates booking with `bus_id = NULL, car_id = NULL`
- Validates: trip is open, not already booked, family member ownership
- Accepts empty `p_family_member_ids` array for head-only booking
- Replaces the need for a separate `book_trip_only` RPC

**`get_all_trips_stats` returns per-trip JSON:**

| Field | Type | What |
|-------|------|------|
| `trip_id`, `title_ar`, `title_en`, `trip_date`, `is_open` | scalar | Trip identity |
| `total_booked` | int | All active bookings (head + family) |
| `total_registered` | int | Total non-deleted profiles in system |
| `by_role` | object | `{role: count}` for head bookings |
| `by_gender` | object | `{Male: N, Female: N}` including family members |
| `by_transport` | object | `{transport_type: count}` for head bookings |
| `wheelchair_count` | int | Wheelchair users (head + family) |
| `family_members_count` | int | Family member bookings |
| `by_sector` | array | `[{name, count}]` for head bookings |
| `transport_breakdown` | object | `{on_bus, in_car, no_transport}` counts |
| `servants_needed` | object | `{"0": N, "1": N, "2": N}` for head bookings |
| `bus_stats` | object | `{total_seats, filled}` |
| `room_stats` | object | `{total_capacity, assigned}` |

**SQL technique:** Uses `CROSS JOIN LATERAL` with correlated scalar subqueries for each stat. Each stat is self-contained (no GROUP BY needed at the LATERAL level). The outer query wraps results in a subquery for `jsonb_agg(row_data ORDER BY trip_date DESC)`.

**New index:**
```sql
CREATE INDEX IF NOT EXISTS idx_bookings_trip_active
  ON public.bookings(trip_id) WHERE cancelled_at IS NULL;
```
Partial index covering the most common dashboard query pattern.

### SQL Bug Fixes (3 iterations)

1. **`room_stats` GROUP BY error**: Original `room_stats` used a nested correlated subquery inside the LATERAL that referenced `t.id` incorrectly. Fixed by using `LEFT JOIN` directly in the LATERAL subquery.

2. **`t.trip_date` GROUP BY error**: The `jsonb_agg()` aggregate function made PostgreSQL require all referenced columns in GROUP BY. Fixed by wrapping in a subquery: `SELECT jsonb_agg(row_data ORDER BY trip_date DESC) FROM (...) sub`.

3. **`sub.trip_date` GROUP BY error**: The wrapper subquery had a redundant outer `ORDER BY sub.trip_date DESC` on an aggregate query. Fixed by removing it — the `ORDER BY` inside `jsonb_agg()` already handles sorting.

### Frontend Changes

**Trips page** (`src/app/(authenticated)/trips/page.tsx`):
- "Choose Bus" (اختر أتوبيس) button per trip card → navigates to bus selection
- "Book Trip" (احجز الرحلة) button per trip card → books trip-only via `book_trip_only_with_family`
- Per-trip family member toggles (separate `Set` per trip, not global)
- Shows family member names with `↳` prefix in passenger lists

**Bus selection page** (`src/app/(authenticated)/trips/[tripId]/buses/page.tsx`):
- "Book without bus" (احجز من غير أتوبيس) card at the bottom
- Calls `bookTripOnly()` from shared utility

**Admin dashboard** (`src/app/(authenticated)/admin/page.tsx`) — complete rewrite:
- Expandable per-trip cards showing all stats from `get_all_trips_stats()`
- Stats displayed: total booked, registered, role breakdown (badges), gender, transport, wheelchair, family members, sector breakdown, servants needed, bus fill rate, room capacity
- Color-coded fill rates (green < 70%, yellow < 90%, red >= 90%)
- Open/closed trip badges
- Mobile-friendly grid layout

**Admin trip detail tabs:**
- `OverviewTab.tsx`: Added "No bus assigned" stat card
- `BusesTab.tsx`: Added `car_id` to bookings query (was missing, causing empty unassigned list), unassigned passengers section with move/cancel buttons

### Shared Utilities

**`src/lib/booking.ts`** (new):
- `bookTripOnly(supabase, tripId, familyMemberIds)` — calls `book_trip_only_with_family` RPC
- `toggleInSet(set, id)` — immutable Set toggle helper for family member selection

**`src/lib/types/database.ts`**:
- New `TripStats` type matching RPC response
- New `PassengerInfo` type (shared by trips page and admin BusesTab)

### i18n Changes (~20 new keys per language)

**Arabic examples:** `اختر أتوبيس`, `احجز الرحلة`, `احجز من غير أتوبيس`, `الركاب`, `الإجمالي`, `نسبة الامتلاء`, `غير محدد أتوبيس`, `فتح`, `مقفل`

**English examples:** `Choose Bus`, `Book Trip`, `Book without bus`, `Passengers`, `Total`, `Fill rate`, `No bus assigned`, `Open`, `Closed`

### Button Text Change

- Trip cards: "Book Now" / "احجز دلوقتي" → "Choose Bus" / "اختر أتوبيس"
- This clarifies that the button navigates to bus selection, not a direct booking

### Code Review Fixes

- Hooks ordering (all `useMemo`/`useCallback` before `useEffect`)
- Memoized `roleBadges` rendering with `useMemo`
- Extracted `renderStatBox` and `getStatusColor` outside component
- Added `aria-label` attributes for accessibility
- Toast on error for dashboard loading failures
- Fill rate calculation extracted to named variable

### Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/00100_trip_only_and_dashboard.sql` | New: 2 RPCs + partial index |
| `src/lib/booking.ts` | New: shared booking utilities |
| `src/lib/types/database.ts` | `TripStats`, `PassengerInfo` types |
| `src/lib/i18n/dictionaries/ar.json` | ~20 new keys |
| `src/lib/i18n/dictionaries/en.json` | ~20 new keys |
| `src/app/(authenticated)/trips/page.tsx` | Trip-only booking + per-trip family toggles |
| `src/app/(authenticated)/trips/[tripId]/buses/page.tsx` | "Book without bus" card |
| `src/app/(authenticated)/admin/page.tsx` | Complete dashboard rewrite |
| `src/app/(authenticated)/admin/trips/[id]/OverviewTab.tsx` | No-bus stat card |
| `src/app/(authenticated)/admin/trips/[id]/BusesTab.tsx` | Unassigned section + car_id fix |

### Manual Supabase Step

Run `00100_trip_only_and_dashboard.sql` in Supabase SQL Editor. Uses `CREATE OR REPLACE FUNCTION` so it's safe to re-run.

### Build Status

- 0 TypeScript errors
- 0 ESLint warnings
- Build passes

---

## Phase 11: Modern UI/UX Redesign (2026-04-23)

### Problem

The app works perfectly but looks utilitarian — flat cards, basic colors, no visual polish. Elderly users appreciate clarity but the overall aesthetic needs to feel modern and professional.

### Solution

**Soft & Elegant redesign** using **shadcn/ui** component library on top of Tailwind CSS. Every page gets a visual upgrade while keeping all existing functionality, routes, data flow, and elderly-friendly sizing.

### Design Direction

- **Style**: Soft & Elegant — rounded cards, subtle gradients, smooth shadows, pastel accents
- **Color scheme**: Enhanced blue (keep current blue primary, make richer with gradients and depth)
- **Component library**: shadcn/ui (zero runtime overhead — copies component source code into project)
- **Scope**: Full redesign of all pages

### New Dependencies

| Package | Purpose | Size Impact |
|---------|---------|-------------|
| `@radix-ui/react-dialog` | Accessible modal dialogs | ~5KB gzipped |
| `@radix-ui/react-dropdown-menu` | Dropdown menus | ~4KB gzipped |
| `@radix-ui/react-tabs` | Accessible tab panels | ~3KB gzipped |
| `@radix-ui/react-switch` | Toggle switches | ~2KB gzipped |
| `@radix-ui/react-select` | Accessible select menus | ~4KB gzipped |
| `@radix-ui/react-separator` | Dividers | ~1KB gzipped |
| `@radix-ui/react-slot` | Polymorphic components | ~1KB gzipped |
| `class-variance-authority` | Component variants | ~2KB gzipped |
| `clsx` | Conditional classnames | ~1KB gzipped |
| `tailwind-merge` | Merge Tailwind classes | ~2KB gzipped |
| `lucide-react` | Modern icon library | Tree-shaken |

### shadcn/ui Components Added

| Component | Replaces |
|-----------|----------|
| Button | `.btn-primary`, `.btn-secondary`, `.btn-danger` CSS classes |
| Card | `.card`, `.card-hover` CSS classes |
| Input | `.input-field` CSS class |
| Badge | `.badge`, `.badge-blue/green/red/amber` CSS classes |
| Dialog | Native `confirm()` + custom UserDetailModal |
| Tabs | Custom admin trip detail tabs |
| Switch | Custom toggle implementations (wheelchair, car, etc.) |
| Select | Native `<select>` dropdowns (sector, role, gender) |
| DropdownMenu | Admin action buttons (move, remove, etc.) |
| Separator | `<hr>` and border dividers |
| Avatar | User initials in lists |
| Label | `.label-text` CSS class |

### Design System Changes (globals.css)

**New CSS custom properties:**
- `--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring` (light + dark variants)
- `--radius` for consistent border radius

**Enhanced visual effects:**
- Multi-layer soft shadows for depth
- Subtle gradient accents on primary elements
- Improved dark mode contrast ratios
- Smoother transitions (200ms ease)
- Better focus ring styles

**Removed CSS classes (replaced by shadcn):**
- `.btn-primary`, `.btn-secondary`, `.btn-danger`
- `.input-field`
- `.card`, `.card-hover`
- `.badge`, `.badge-blue/green/red/amber`
- `.label-text`

**Kept CSS classes:**
- `.section-title` (updated with new tokens)
- `.progress-bar`, `.progress-bar-fill` (updated styling)
- `.hide-scrollbar`
- Animations: `animate-fade-in`, `animate-slide-up`, `animate-slide-down`

### Page-by-Page Changes

**Login & Signup:**
- Glass-morphism floating card with animated gradient background
- shadcn Input + Label + Button components
- Smoother form spacing and transitions
- Modern switch for "Remember me" and wheelchair toggle

**Trips listing (patient):**
- Richer trip cards with gradient headers and better data hierarchy
- shadcn Badge for status indicators
- Animated expand/collapse for passenger lists
- Better family member toggle chips

**Bus selection:**
- Card grid with visual progress bars
- shadcn Dialog for confirmations
- Better visual distinction between bus/car/trip-only options

**Admin dashboard:**
- Stat cards with subtle gradient backgrounds
- shadcn Badge for role/gender breakdowns
- Progress bars with rounded ends and gradient fills
- Expandable trip sections with smooth animation

**Admin trip detail (5 tabs):**
- shadcn Tabs with smooth transitions
- shadcn DropdownMenu for passenger actions
- shadcn Dialog for move/remove confirmations
- Better content spacing in each tab

**Admin users page:**
- shadcn Dialog for UserDetailModal
- shadcn Select for role/sector filters
- shadcn Switch for car settings
- Cleaner table-like layout with hover states

**Settings page:**
- Grouped sections in shadcn Card wrappers
- shadcn Input for name/phone/password fields
- shadcn Switch for toggles
- Better visual hierarchy between sections

**Header & MobileNav:**
- Frosted glass effect (`backdrop-blur-lg`) with refined active states
- Lucide icons replacing inline SVGs
- Smoother transition animations
- Refined bottom nav with better active indicators

### What Stays the Same

- All business logic, data fetching, RPC calls
- RTL/Arabic-first layout (`dir="rtl"`, `lang="ar"`)
- i18n dictionary approach (no new keys needed)
- Dark mode via `next-themes`
- Elderly-friendly sizing (18px base font, 48px min buttons)
- All routes and navigation structure
- All database schema, RLS policies, migrations
- All coding conventions from Phase 6

### Files Changed

| File | Change |
|------|--------|
| `tailwind.config.ts` | Extended with shadcn/ui theme tokens |
| `src/app/globals.css` | New design system with CSS variables |
| `src/lib/utils.ts` | New: `cn()` utility for class merging |
| `src/components/ui/*` | New: shadcn/ui component files |
| `src/components/Header.tsx` | Lucide icons + refined styling |
| `src/components/MobileNav.tsx` | Lucide icons + refined styling |
| `src/components/ThemeToggle.tsx` | shadcn Button |
| `src/components/LanguageToggle.tsx` | shadcn Button |
| `src/components/LoadingSpinner.tsx` | Refined styling |
| `src/components/Toast.tsx` | Updated with new tokens |
| `src/app/login/page.tsx` | Full visual redesign |
| `src/app/signup/page.tsx` | Full visual redesign |
| `src/app/(authenticated)/trips/page.tsx` | Full visual redesign |
| `src/app/(authenticated)/trips/[tripId]/buses/page.tsx` | Full visual redesign |
| `src/app/(authenticated)/settings/page.tsx` | Full visual redesign |
| `src/app/(authenticated)/admin/page.tsx` | Full visual redesign |
| `src/app/(authenticated)/admin/trips/page.tsx` | Full visual redesign |
| `src/app/(authenticated)/admin/trips/[id]/page.tsx` | shadcn Tabs |
| `src/app/(authenticated)/admin/trips/[id]/OverviewTab.tsx` | shadcn Card/Badge |
| `src/app/(authenticated)/admin/trips/[id]/BusesTab.tsx` | shadcn components |
| `src/app/(authenticated)/admin/trips/[id]/RoomsTab.tsx` | shadcn components |
| `src/app/(authenticated)/admin/trips/[id]/CarsTab.tsx` | shadcn components |
| `src/app/(authenticated)/admin/trips/[id]/UnbookedTab.tsx` | shadcn components |
| `src/app/(authenticated)/admin/users/page.tsx` | shadcn Dialog/Select/Switch |
| `src/app/(authenticated)/admin/users/UserDetailModal.tsx` | shadcn Dialog |
| `src/app/(authenticated)/admin/sectors/page.tsx` | shadcn components |
| `src/app/(authenticated)/admin/logs/page.tsx` | shadcn components |
| `src/app/(authenticated)/admin/reports/page.tsx` | shadcn components |
| `src/lib/i18n/dictionaries/ar.json` | Minor key additions if needed |
| `src/lib/i18n/dictionaries/en.json` | Minor key additions if needed |

### Performance Impact

- shadcn/ui adds zero runtime framework (source code is copied)
- Radix primitives add ~15-20KB gzipped total (tree-shaken)
- `lucide-react` icons are individually imported and tree-shaken
- No change to loading speed or bundle splitting strategy

---

## Phase 12: Arabic Name Update + RTL-Safe Toggle (2026-04-28)

### Problem

1. Arabic site name needed to change from `القديسة ديمانه` to `خدمه فيرينا`
2. Previous toggle switch used `translate-x` which breaks in RTL mode — the thumb slides in the wrong direction
3. `lucide-react` dependency was missing, causing build failures and TypeScript errors

### Solution

1. **Arabic name**: Updated in Header.tsx (mobile + desktop) and layout.tsx metadata
2. **RTL-safe Toggle**: Replaced sliding toggle with a checkbox-style toggle that uses no `translate-x`, works identically in LTR and RTL:
   - Blue filled square with white checkmark (ON)
   - Empty bordered square (OFF)
   - `active:scale-90` press feedback
   - 3 sizes: `sm` (16px), `md` (20px), `lg` (24px)
   - `focus-visible` ring for keyboard accessibility
   - Dark mode support
3. **Dependency fix**: Installed missing `lucide-react` package — fixed all TypeScript errors across 10+ files

### Files Changed

| File | Change |
|------|--------|
| `src/components/Toggle.tsx` | New: RTL-safe checkbox-style toggle |
| `src/components/Header.tsx` | Arabic name → خدمه فيرينا |
| `src/app/layout.tsx` | Browser tab title with Arabic name |
| `src/app/(authenticated)/settings/page.tsx` | Switch → Toggle (wheelchair + car) |
| `src/app/(authenticated)/admin/sectors/page.tsx` | Switch → Toggle (active/inactive) |
| `src/app/(authenticated)/admin/users/page.tsx` | Switch → Toggle (wheelchair + car + family) |
| `src/app/(authenticated)/admin/trips/[id]/UnbookedTab.tsx` | Inline toggle → Toggle component |
| `src/app/signup/page.tsx` | Switch → Toggle (wheelchair) |
| `src/app/login/page.tsx` | Switch → Toggle (remember me) |
| `package.json` | Added `lucide-react` dependency |

### Build Status

- 0 TypeScript errors (was 50+ before `lucide-react` fix)
- Toggle works correctly in both LTR and RTL

---

## Phase 13: Arabic Typo Fixes + Phone 11-Digit Limit (2026-04-29)

### Problem

1. Arabic text had a systematic typo: "القطاعة" (with ة) instead of "القطاع" (sector) across the entire app
2. Other Arabic typos: missing letter in "ممكن تمسش" and missing hamza in "الغاء"
3. Phone input accepted 8–15 digits, but Egyptian numbers are always exactly 11 digits (01XXXXXXXXX). Elderly users and patients could get confused by being able to type too many or too few digits

### Solution

1. **Arabic typo fixes** across the entire `ar.json` dictionary
2. **Phone input limited to exactly 11 digits** across all 5 phone input locations, with proper input attributes and digit stripping

### Arabic Typo Fixes

| Typo | Correction | Occurrences |
|------|-----------|-------------|
| القطاعة | القطاع | 10 in ar.json + 1 in docs |
| قطاعة جديدة | قطاع جديد | 1 |
| قطاعتك | قطاعك | 1 |
| بدون قطاعة | بدون قطاع | 1 |
| ممكن تمسش | ممكن تمسحش | 1 (missing ح) |
| الغاء | إلغاء | 2 (missing hamza) |

### Phone 11-Digit Limit

**`PHONE_REGEX`** changed from `/^\d{8,15}$/` to `/^\d{11}$/` in `src/lib/constants.ts`.

All 5 phone input locations updated:

| File | Changes |
|------|---------|
| `src/lib/constants.ts` | Regex: `\d{8,15}` → `\d{11}` |
| `src/app/login/page.tsx` | `slice(0,11)` + `maxLength={11}` |
| `src/app/signup/page.tsx` | `slice(0,11)` + `maxLength={11}` |
| `src/app/(authenticated)/settings/page.tsx` | `slice(0,11)` + `maxLength={11}` |
| `src/app/(authenticated)/admin/users/page.tsx` | Now uses shared `PHONE_REGEX`, added `type="tel"` + `inputMode="numeric"` + digit stripping + `maxLength={11}` |
| `src/app/(authenticated)/admin/trips/[id]/UnbookedTab.tsx` | Same as above |

**Admin inputs also fixed** — they previously lacked `type="tel"`, `inputMode="numeric"`, digit stripping, and used inline regex instead of the shared `PHONE_REGEX` constant.

### Note

Backend SQL function `update_own_phone()` still validates `^\d{8,15}$`. A new migration would be needed to enforce the 11-digit rule server-side if desired.

### Files Changed

| File | Change |
|------|--------|
| `src/lib/constants.ts` | `PHONE_REGEX` updated to exactly 11 digits |
| `src/lib/i18n/dictionaries/ar.json` | 16 typo fixes |
| `src/app/login/page.tsx` | Phone limit 11 + maxLength |
| `src/app/signup/page.tsx` | Phone limit 11 + maxLength |
| `src/app/(authenticated)/settings/page.tsx` | Phone limit 11 + maxLength |
| `src/app/(authenticated)/admin/users/page.tsx` | Shared regex + proper input attrs + limit 11 |
| `src/app/(authenticated)/admin/trips/[id]/UnbookedTab.tsx` | Shared regex + proper input attrs + limit 11 |
| `docs/superpowers/plans/2026-04-22-trip-only-booking-and-dashboard.md` | Typo fix |

### Build Status

- 0 TypeScript errors
- 0 ESLint warnings
- Build passes
