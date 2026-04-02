# CTRMS — Church Trip & Room Management System

## Overview

Bilingual (AR/EN) web application for managing church trips, bus bookings, and room assignments. Built with Next.js App Router, Tailwind CSS, and Supabase (PostgreSQL, Auth, Edge Functions).

**Users:** ~40 concurrent users. Elderly patients (Arabic-speaking, need large text and simple UI). Servants act as admins.

---

## 1. Roles

| Role | Can do |
|------|--------|
| **patient** | Browse open trips, book a seat on a bus, view own bookings |
| **servant** | Everything a patient can do, plus: manage trips/buses/rooms, assign rooms, register new patients, book on behalf of patients, generate PDF reports |

Servants and patients share the same auth system. Role is stored in `profiles.role`.

---

## 2. Database Schema

### profiles
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid PK | References `auth.users.id` |
| phone | text | UNIQUE NOT NULL |
| full_name | text | NOT NULL |
| gender | text | NOT NULL CHECK IN ('Male','Female') |
| role | text | NOT NULL DEFAULT 'patient' CHECK IN ('servant','patient') |
| created_at | timestamptz | DEFAULT now() |

### trips
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid PK | gen_random_uuid() |
| title_ar | text | NOT NULL |
| title_en | text | NOT NULL |
| trip_date | date | NOT NULL |
| is_open | boolean | DEFAULT true |
| created_at | timestamptz | DEFAULT now() |

### buses
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid PK | gen_random_uuid() |
| trip_id | uuid FK | → trips(id) ON DELETE CASCADE |
| area_name_ar | text | NOT NULL |
| area_name_en | text | NOT NULL |
| capacity | int | NOT NULL CHECK (capacity > 0) |
| leader_name | text | |

### rooms
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid PK | gen_random_uuid() |
| trip_id | uuid FK | → trips(id) ON DELETE CASCADE |
| room_type | text | NOT NULL CHECK IN ('Male','Female') |
| capacity | int | NOT NULL CHECK (capacity > 0) |
| supervisor_name | text | |
| room_label | text | NOT NULL |

### bookings
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid PK | gen_random_uuid() |
| user_id | uuid FK | → profiles(id) |
| trip_id | uuid FK | → trips(id) |
| bus_id | uuid FK | → buses(id) |
| room_id | uuid FK | → rooms(id) NULLABLE |
| created_at | timestamptz | DEFAULT now() |
| cancelled_at | timestamptz | NULL |

**Constraints:**
- UNIQUE (user_id, trip_id) WHERE cancelled_at IS NULL — one active booking per user per trip
- Bookings with cancelled_at set are excluded from capacity counts

### Indexes (for performance with ~40 concurrent users)
- `bookings(trip_id)` — fast trip lookup
- `bookings(bus_id)` — fast bus capacity count
- `bookings(room_id)` — fast room capacity count
- `bookings(user_id)` — fast user bookings lookup
- `profiles(phone)` — unique index for phone lookup

---

## 3. Auth

- **Phone + password** login using Supabase email auth hack: phone stored as `{phone}@church.local` in `auth.users.email`
- **Supabase trigger** on `auth.users` creation auto-inserts `profiles` row
- **No email verification** — private app
- **Session:** Supabase JWT via `@supabase/ssr` cookies, 7-day session timeout
- **Middleware:** Protected routes, role-based redirect (patient → `/trips`, servant → `/admin`)

### Signup fields
- Phone number, full name, gender (Male/Female), password

### Auth pages
- `/login` — phone + password, link to signup
- `/signup` — phone + name + gender + password, link to login

---

## 4. Patient UI (Elderly-Friendly)

**Design principles for elderly users:**
- Base font 18px minimum, buttons 20px+, min 48px button height
- One action per screen, vertical stacking, no side-by-side choices
- Arabic labels with simple words, no jargon
- Color-coded: green = available, red = full, gray = closed
- Confirmation dialog before finalizing booking
- High contrast: black text on white/light backgrounds
- No hamburger menus — everything visible
- Back button always visible at top-left
- Long session timeout (7 days)
- Already-booked trips show green check, cannot re-book

### Patient Flow (4 screens)

**Screen 1: Login** — Phone + password, big button, small "register" link

**Screen 2: Choose Trip** — List of open trips as large cards. Each card shows trip title (Arabic), date, and a big "Book Now" button. Below the cards, a "My Previous Bookings" section with confirmed bookings marked with a green check.

**Screen 3: Choose Bus** — After selecting a trip, shows buses for that trip as large cards. Each card shows area name (Arabic), leader name, capacity bar (visual), available seats count, and a big "Choose This" button. Full buses are grayed out with "Full" badge.

**Screen 4: Confirmation** — Big green checkmark, trip name, bus area, leader, date. One big "OK" button to return to trips.

### Error handling for patients
- All error messages in simple Arabic: "الباص ده مليان — اختار باص تاني"
- Toast notifications (top-center, auto-dismiss)
- Buttons disable after first click (prevent double-booking)
- Loading spinner on every action

---

## 5. Servant (Admin) UI

### Dashboard (`/admin`)
Card for each trip with quick stats:
- Total registered users, booked count, unbooked count
- Bus seats filled ratio, rooms assigned ratio

### Trip Management (`/admin/trips`)
- CRUD for trips (title AR/EN, date, open/closed toggle)

### Trip Detail Hub (`/admin/trips/[id]`)
- **3-tab layout:** Buses | Rooms | Unbooked
- Trip name and stats shown at top of all tabs

### Tab: Buses
- CRUD for buses under this trip (area name AR/EN, capacity, leader)
- Each bus card shows area, leader, capacity bar, passenger count

### Tab: Rooms
- CRUD for rooms under this trip (room_type, capacity, supervisor, label)
- **Click-to-assign UI:** Two-column layout — unassigned people list on left, rooms on right. Click person → click room → assigned. Gender validation enforced.
- Shows assigned vs unassigned count per room

### Tab: Unbooked
- Shows all registered users who haven't booked this trip
- Columns: Name, Phone, Gender, "Book" button
- Search by name, filter by gender
- Count at top: "12 unbooked (7M, 5F)"
- **"Register New Patient" button** — form with phone, name, gender, password. Creates auth account + profile. Optionally also books them into a bus in the same flow.

### Reports (`/admin/reports`)
- Select trip → generate Bus Report or Room Report
- PDF rendered in Arabic via Supabase Edge Function

---

## 6. Data Integrity & Error Handling

### Database-level guards
- `profiles.phone` UNIQUE
- `bookings(user_id, trip_id) WHERE cancelled_at IS NULL` UNIQUE
- CHECK constraints on gender, role, room_type, capacity
- All FKs with appropriate CASCADE/SET NULL

### Application-level guards
- Check before insert: duplicate phone, existing booking, bus capacity, room capacity, gender match, trip open status
- Every check returns a user-friendly Arabic error message

### Transaction safety
- **RPC function: `register_and_book`** — creates auth user + profile + booking in one transaction. Full rollback on any failure.
- **RPC function: `assign_room`** — validates gender match + room capacity, then updates booking. Atomic.
- **RPC function: `cancel_booking`** — sets cancelled_at, frees bus seat and room slot.

### Race condition protection
- Bus capacity check uses row-level locking in the RPC transaction
- Two simultaneous bookings for the last seat: one succeeds, other gets "Bus is full"

### Soft delete
- No hard deletes on bookings. Use `cancelled_at` column.
- Cancelled bookings excluded from capacity counts and reports.
- UNIQUE constraint allows re-booking after cancellation.

### Servant registers existing phone
- Catch unique violation, show: "Patient already registered — [Go to booking]"

### UI safeguards
- Buttons disable after first click
- Optimistic UI disabled — wait for server confirmation
- Loading state on every action
- Toast notifications for all success/error states

---

## 7. PDF Reports (Supabase Edge Function)

- Deno runtime, uses `pdf-lib` for generation
- Reports always in Arabic (RTL layout)
- **Report A — Bus Report:** Input `trip_id`. Grouped by bus area. Lists all passengers and leader per bus.
- **Report B — Room Report:** Input `trip_id`. Grouped by room label. Lists occupants and supervisor per room.

---

## 8. RLS Policies

### patients
- SELECT own bookings (`auth.uid() = user_id`)
- INSERT own bookings (with check that trip is open)
- SELECT open trips, buses (read-only)
- SELECT own profile

### servants
- Full CRUD on trips, buses, rooms
- Full CRUD on bookings (including assigning room_id)
- Can INSERT new profiles (register patients)
- Can view all profiles and bookings

---

## 9. i18n (Internationalization)

- Custom dictionary approach (no URL prefixes)
- Language stored in cookie, toggle button in header
- JSON translation files: `ar.json`, `en.json`
- RTL support via `dir` attribute on `<html>` — switches dynamically
- Arabic is default language

---

## 10. Performance Considerations

~40 concurrent users is low load, but we still optimize:

- **Supabase connection pooling** via Supavisor (default)
- **Indexes** on all FK columns and frequently queried fields
- **RPC functions** for complex operations (avoids multiple round trips)
- **No unnecessary real-time subscriptions** — use standard queries with manual refresh
- **Client-side caching** of trip/bus data with `react-query` or SWR (stale-while-revalidate)
- **Pagination** on unbooked users list (20 per page)
- **Debounced search** on unbooked list (300ms)
- **Lightweight Tailwind** — no heavy UI libraries, custom components only

---

## 11. Page Routes

```
/login                          → Auth (unauthenticated only)
/signup                         → Auth (unauthenticated only)
/trips                          → Patient: list open trips + book
/admin                          → Servant: dashboard
/admin/trips                    → Servant: manage trips (CRUD)
/admin/trips/[id]/buses         → Servant: manage buses for a trip
/admin/trips/[id]/rooms         → Servant: manage rooms + assign people
/admin/reports                  → Servant: generate PDF reports
```
