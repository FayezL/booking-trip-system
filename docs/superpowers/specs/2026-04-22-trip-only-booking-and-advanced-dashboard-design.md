# Trip-Only Booking + Advanced Dashboard Design

> Date: 2026-04-22
> Status: Approved

---

## Overview

Two features:

1. **Trip-only booking** — Users can sign up for a trip without choosing a bus or car. `bus_id = NULL`, `car_id = NULL`.
2. **Advanced admin dashboard** — Replace the current `/admin` dashboard with rich per-trip stats: role, gender, wheelchair, transport, sector, family members, and more.

---

## Feature 1: Trip-Only Booking

### Database Changes

**New RPC: `book_trip_only(p_user_id uuid, p_trip_id uuid)`**
- Creates a booking with `bus_id = NULL`, `car_id = NULL`, `room_id = NULL`
- Checks: trip exists, trip is open (`is_open = true`), user has no existing active booking for this trip
- Uses the existing partial unique index for duplicate prevention
- Authorization: `is_admin() OR auth.uid() = p_user_id`

**New RPC: `book_trip_only_with_family(p_user_id uuid, p_trip_id uuid, p_family_member_ids uuid[])`**
- Same as above but also books selected family members (all with `bus_id = NULL`)
- Follows the same transaction pattern as `book_bus_with_family`
- Creates one booking for the head + one per family member
- Authorization: `is_admin() OR auth.uid() = p_user_id`

### UI: `/trips` page (Patient Trips List)

- Add a primary **"Book Trip" / "احجز الرحلة"** button on each trip card
- The existing "Choose Bus" / "اختر الأتوبيس" link remains for bus selection
- If user already booked (with or without bus): show green "Booked ✓" / "تم الحجز ✓" badge, disable the book button
- Family members: if user has family members, show the same toggle UI as the bus page
  - When family members are selected, the button says "Book for N people"
- On success: show toast "You're booked! An admin will assign your bus later." / "تم الحجز! هيعينوا الأتوبيس بعدين."

### UI: `/trips/[tripId]/buses` page (Bus Selection)

- Add a card at the top (before bus groups): "Book without choosing a bus" / "احجز بدون اختيار أتوبيس"
- This card has a button that calls `book_trip_only_with_family` (or `book_trip_only` if no family)
- Family member toggles already exist on this page — reuse them

### Admin: Handling Unassigned Passengers

- **OverviewTab**: Add a new stat card "No bus assigned" / "بدون أتوبيس" showing count of bookings with `bus_id IS NULL`
- **BusesTab**: Add a section at the top "Unassigned passengers" / "ركاب بدون أتوبيس" showing all passengers with `bus_id IS NULL`. Admin can use existing `move_passenger_bus` to assign them.
- **`get_trip_passengers` RPC**: Already returns `bus_id` — no change needed

### Cancel Behavior

- Cancelling a trip-only booking works the same as any booking (via `cancel_booking` RPC)
- If head cancels, family member bookings also cancelled (existing cascade logic)

### i18n Keys Needed

```
trips.bookTrip = "احجز الرحلة" / "Book Trip"
trips.booked = "تم الحجز ✓" / "Booked ✓"
trips.bookTripFor = "احجز لـ {count} أشخاص" / "Book for {count} people"
trips.bookedNoBus = "تم الحجز! هيعينوا الأتوبيس بعدين." / "Booked! Admin will assign your bus later."
buses.bookWithoutBus = "احجز بدون اختيار أتوبيس" / "Book without choosing a bus"
buses.bookWithoutBusDesc = "هيتم تعيين أتوبيس بعدين" / "A bus will be assigned later"
admin.noBusAssigned = "بدون أتوبيس" / "No bus"
admin.unassignedPassengers = "ركاب بدون أتوبيس" / "Unassigned passengers"
```

---

## Feature 2: Advanced Admin Dashboard

### New RPC: `get_all_trips_stats()`

SECURITY DEFINER, admin-only. Returns a single JSON array with aggregated stats per trip.

```sql
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
```

**Per-trip returned object:**

| Field | Type | Source |
|-------|------|--------|
| `trip_id` | uuid | trips.id |
| `title_ar` | text | trips.title_ar |
| `title_en` | text | trips.title_en |
| `trip_date` | date | trips.trip_date |
| `is_open` | boolean | trips.is_open |
| `total_booked` | int | COUNT active bookings |
| `total_registered` | int | COUNT non-deleted profiles |
| `by_role` | jsonb | GROUP BY profiles.role for booked users |
| `by_gender` | jsonb | { male: N, female: N } — uses COALESCE(fm.gender, p.gender) |
| `by_transport` | jsonb | { bus: N, private: N } — from profiles.transport_type |
| `wheelchair_count` | int | COALESCE(fm.has_wheelchair, p.has_wheelchair) = true |
| `family_members_count` | int | COUNT bookings WHERE family_member_id IS NOT NULL |
| `by_sector` | jsonb array | [{ sector_name, count }] |
| `transport_breakdown` | jsonb | { on_bus: N, in_car: N, no_transport: N } — based on bus_id/car_id |
| `servants_needed` | jsonb | { 0: N, 1: N, 2: N } — from profiles.servants_needed |
| `bus_stats` | jsonb | { total_seats: N, filled: N } |
| `room_stats` | jsonb | { total_capacity: N, assigned: N } |

**SQL approach**: Single query joining trips, bookings, profiles, family_members, buses, rooms, and sectors. Aggregate with `json_agg` and `json_build_object`.

### Dashboard Layout: `/admin` page

**Top summary row** — 4 stat cards (all trips combined):
1. Total open trips
2. Total bookings across all trips
3. Total wheelchair users booked
4. Total family members booked

**Per-trip cards** — Each trip is an expandable card. Click to expand/collapse.

**Expanded card sections:**

| Section | Display |
|---------|---------|
| Overview | Booked/Registered, Bus seats filled/total, Rooms assigned/total |
| By Role | Colored badges per role with counts |
| By Gender | ♂ Male: N, ♀ Female: N |
| Wheelchair | ♿ With wheelchair: N, Without: N |
| Transport Breakdown | 🚌 On bus: N, 🚗 In car: N, 🚶 No transport: N |
| Transport Type | Bus preference: N, Private: N |
| Servants Needed | 0: N, 1: N, 2: N |
| By Sector | Sector name badges with counts |
| Family | 👨‍👩‍👧 Family members: N |
| Fill Rate | Progress bars per area group |

Clicking the trip title navigates to `/admin/trips/[id]` (existing trip detail page).

### Visual Design

- Cards use existing `card` and `card-hover` CSS classes
- Stats use the existing colored background pattern (blue-50, red-50, purple-50, etc.)
- Role badges match existing colors (blue for patient, green for servant, etc.)
- Progress bars use existing `progress-bar` component class
- Dark mode compatible (all existing dark: classes apply)
- Responsive: grid-cols-2 on mobile, grid-cols-4 on desktop for stat cards

### i18n Keys Needed

```
admin.dashboard = "لوحة التحكم" / "Dashboard"
admin.totalTrips = "إجمالي الرحلات" / "Total Trips"
admin.totalBookings = "إجمالي الحجوزات" / "Total Bookings"
admin.totalWheelchairs = "كراسي متحركة" / "Wheelchairs"
admin.totalFamilyMembers = "أفراد العائلة" / "Family Members"
admin.byRole = "حسب الدور" / "By Role"
admin.byGender = "حسب النوع" / "By Gender"
admin.male = "ذكور" / "Male"
admin.female = "إناث" / "Female"
admin.wheelchair = "كرسي متحرك" / "Wheelchair"
admin.withoutWheelchair = "بدون كرسي" / "Without Wheelchair"
admin.transportBreakdown = "وسيلة النقل" / "Transport"
admin.onBus = "أتوبيس" / "On Bus"
admin.inCar = "عربية" / "In Car"
admin.noTransport = "بدون نقل" / "No Transport"
admin.bySector = "حسب المنطقة" / "By Sector"
admin.familyMembers = "أفراد العائلة" / "Family Members"
admin.servantsNeeded = "محتاجين خدمة" / "Servants Needed"
admin.fillRate = "نسبة الامتلاء" / "Fill Rate"
admin.openTrips = "رحلات مفتوحة" / "Open Trips"
admin.closedTrips = "رحلات مقفولة" / "Closed Trips"
```

---

## Files to Change

| File | Change |
|------|--------|
| `supabase/migrations/00100_trip_only_and_dashboard.sql` | New RPCs + updated RPCs |
| `src/app/(authenticated)/trips/page.tsx` | Add "Book Trip" button + family toggles |
| `src/app/(authenticated)/trips/[tripId]/buses/page.tsx` | Add "Book without bus" card |
| `src/app/(authenticated)/admin/page.tsx` | Full rewrite — advanced dashboard |
| `src/app/(authenticated)/admin/trips/[id]/OverviewTab.tsx` | Add "No bus assigned" stat |
| `src/app/(authenticated)/admin/trips/[id]/BusesTab.tsx` | Add unassigned passengers section |
| `src/lib/i18n/dictionaries/ar.json` | New keys |
| `src/lib/i18n/dictionaries/en.json` | New keys |
| `src/lib/types/database.ts` | New types for trip stats |

---

## SQL Migration: `00100_trip_only_and_dashboard.sql`

Contents:

1. **`book_trip_only(p_user_id, p_trip_id)`** — new RPC
2. **`book_trip_only_with_family(p_user_id, p_trip_id, p_family_member_ids[])`** — new RPC
3. **`get_all_trips_stats()`** — new RPC for dashboard
4. **Updated `get_trip_passengers`** — return `bus_id` and `car_id` in response (if not already)
