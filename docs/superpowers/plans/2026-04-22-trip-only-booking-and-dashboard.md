# Trip-Only Booking + Advanced Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to book trips without choosing a bus, and replace the admin dashboard with an advanced stats dashboard.

**Architecture:** New SQL RPCs for trip-only booking and dashboard stats. Frontend changes to the trips page, bus selection page, admin dashboard, and admin trip detail tabs. All follow existing codebase patterns.

**Tech Stack:** Next.js 14, Supabase RPC (SECURITY DEFINER), TypeScript, Tailwind CSS, i18n dictionaries

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `supabase/migrations/00100_trip_only_and_dashboard.sql` | Create | 3 new RPCs (`book_trip_only`, `book_trip_only_with_family`, `get_all_trips_stats`) |
| `src/lib/types/database.ts` | Modify | Add `TripStats` type |
| `src/lib/i18n/dictionaries/ar.json` | Modify | Add ~20 new Arabic keys |
| `src/lib/i18n/dictionaries/en.json` | Modify | Add ~20 new English keys |
| `src/app/(authenticated)/trips/page.tsx` | Modify | Add "Book Trip" button + family member toggles |
| `src/app/(authenticated)/trips/[tripId]/buses/page.tsx` | Modify | Add "Book without bus" card at top |
| `src/app/(authenticated)/admin/page.tsx` | Rewrite | Advanced dashboard with full stats |
| `src/app/(authenticated)/admin/trips/[id]/OverviewTab.tsx` | Modify | Add "No bus assigned" stat card |
| `src/app/(authenticated)/admin/trips/[id]/BusesTab.tsx` | Modify | Add unassigned passengers section |

---

### Task 1: SQL Migration — New RPCs

**Files:**
- Create: `supabase/migrations/00100_trip_only_and_dashboard.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- ============================================================
-- Migration: Trip-Only Booking + Advanced Dashboard
-- ============================================================

-- 1. NEW RPC: book_trip_only
-- Books a trip without choosing a bus (bus_id = NULL, car_id = NULL)
CREATE OR REPLACE FUNCTION public.book_trip_only(
  p_user_id uuid,
  p_trip_id uuid
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_booking_id uuid;
BEGIN
  IF NOT public.is_admin() AND auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'You can only book for yourself';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.trips WHERE id = p_trip_id AND is_open = true) THEN
    RAISE EXCEPTION 'Trip is not open';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bookings
    WHERE user_id = p_user_id AND trip_id = p_trip_id AND family_member_id IS NULL AND cancelled_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Already booked this trip';
  END IF;

  INSERT INTO public.bookings (user_id, trip_id, bus_id, car_id)
  VALUES (p_user_id, p_trip_id, NULL, NULL)
  RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END;
$$;

-- 2. NEW RPC: book_trip_only_with_family
-- Books head + selected family members on a trip without choosing a bus
CREATE OR REPLACE FUNCTION public.book_trip_only_with_family(
  p_user_id uuid,
  p_trip_id uuid,
  p_family_member_ids uuid[] DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_booking_id uuid;
  v_valid_count int;
  v_fm_id uuid;
BEGIN
  IF NOT public.is_admin() AND auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'You can only book for yourself';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.trips WHERE id = p_trip_id AND is_open = true) THEN
    RAISE EXCEPTION 'Trip is not open';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bookings
    WHERE user_id = p_user_id AND trip_id = p_trip_id AND family_member_id IS NULL AND cancelled_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Already booked this trip';
  END IF;

  IF array_length(p_family_member_ids, 1) > 0 THEN
    SELECT COUNT(*) INTO v_valid_count
    FROM public.family_members
    WHERE id = ANY(p_family_member_ids) AND head_user_id = p_user_id;

    IF v_valid_count != array_length(p_family_member_ids, 1) THEN
      RAISE EXCEPTION 'Invalid family member';
    END IF;

    FOR v_fm_id IN SELECT unnest(p_family_member_ids) LOOP
      IF EXISTS (
        SELECT 1 FROM public.bookings
        WHERE user_id = p_user_id AND trip_id = p_trip_id
          AND family_member_id = v_fm_id AND cancelled_at IS NULL
      ) THEN
        RAISE EXCEPTION 'Family member already booked this trip';
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.bookings (user_id, trip_id, bus_id, car_id)
  VALUES (p_user_id, p_trip_id, NULL, NULL)
  RETURNING id INTO v_booking_id;

  IF array_length(p_family_member_ids, 1) > 0 THEN
    FOR v_fm_id IN SELECT unnest(p_family_member_ids) LOOP
      INSERT INTO public.bookings (user_id, trip_id, bus_id, car_id, family_member_id)
      VALUES (p_user_id, p_trip_id, NULL, NULL, v_fm_id);
    END LOOP;
  END IF;

  RETURN v_booking_id;
END;
$$;

-- 3. NEW RPC: get_all_trips_stats
-- Returns aggregated stats for all trips (admin only)
CREATE OR REPLACE FUNCTION public.get_all_trips_stats()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_total_registered int;
  v_result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT COUNT(*) INTO v_total_registered FROM public.profiles WHERE deleted_at IS NULL;

  SELECT jsonb_agg(jsonb_build_object(
    'trip_id', t.id,
    'title_ar', t.title_ar,
    'title_en', t.title_en,
    'trip_date', t.trip_date,
    'is_open', t.is_open,
    'total_booked', stats.total_booked,
    'total_registered', v_total_registered,
    'by_role', stats.by_role,
    'by_gender', stats.by_gender,
    'by_transport', stats.by_transport,
    'wheelchair_count', stats.wheelchair_count,
    'family_members_count', stats.family_members_count,
    'by_sector', stats.by_sector,
    'transport_breakdown', stats.transport_breakdown,
    'servants_needed', stats.servants_needed,
    'bus_stats', stats.bus_stats,
    'room_stats', stats.room_stats
  )) INTO v_result
  FROM public.trips t
  CROSS JOIN LATERAL (
    SELECT
      COALESCE(
        (SELECT jsonb_object_agg(role, cnt) FROM (
          SELECT p.role, COUNT(*) as cnt
          FROM public.bookings b
          JOIN public.profiles p ON p.id = b.user_id
          WHERE b.trip_id = t.id AND b.cancelled_at IS NULL AND p.deleted_at IS NULL
            AND b.family_member_id IS NULL
          GROUP BY p.role
        ) r),
        '{}'::jsonb
      ) as by_role,

      COALESCE(
        (SELECT jsonb_build_object(
          'Male', COALESCE(SUM(CASE WHEN COALESCE(fm.gender, p.gender) = 'Male' THEN 1 ELSE 0 END), 0),
          'Female', COALESCE(SUM(CASE WHEN COALESCE(fm.gender, p.gender) = 'Female' THEN 1 ELSE 0 END), 0)
        )
        FROM public.bookings b
        JOIN public.profiles p ON p.id = b.user_id
        LEFT JOIN public.family_members fm ON fm.id = b.family_member_id
        WHERE b.trip_id = t.id AND b.cancelled_at IS NULL AND p.deleted_at IS NULL),
        '{"Male": 0, "Female": 0}'::jsonb
      ) as by_gender,

      COALESCE(
        (SELECT jsonb_object_agg(transport_type, cnt) FROM (
          SELECT p.transport_type, COUNT(*) as cnt
          FROM public.bookings b
          JOIN public.profiles p ON p.id = b.user_id
          WHERE b.trip_id = t.id AND b.cancelled_at IS NULL AND p.deleted_at IS NULL
            AND b.family_member_id IS NULL
          GROUP BY p.transport_type
        ) r),
        '{}'::jsonb
      ) as by_transport,

      COALESCE(
        (SELECT COUNT(*) FROM public.bookings b
         JOIN public.profiles p ON p.id = b.user_id
         LEFT JOIN public.family_members fm ON fm.id = b.family_member_id
         WHERE b.trip_id = t.id AND b.cancelled_at IS NULL AND p.deleted_at IS NULL
           AND COALESCE(fm.has_wheelchair, p.has_wheelchair) = true),
        0
      ) as wheelchair_count,

      COALESCE(
        (SELECT COUNT(*) FROM public.bookings b
         WHERE b.trip_id = t.id AND b.cancelled_at IS NULL AND b.family_member_id IS NOT NULL),
        0
      ) as family_members_count,

      COALESCE(
        (SELECT jsonb_agg(jsonb_build_object('name', sector_name, 'count', cnt)) FROM (
          SELECT COALESCE(s.name, 'Unassigned') as sector_name, COUNT(*) as cnt
          FROM public.bookings b
          JOIN public.profiles p ON p.id = b.user_id
          LEFT JOIN public.sectors s ON s.id = p.sector_id
          WHERE b.trip_id = t.id AND b.cancelled_at IS NULL AND p.deleted_at IS NULL
            AND b.family_member_id IS NULL
          GROUP BY s.name
        ) sec),
        '[]'::jsonb
      ) as by_sector,

      COALESCE(
        (SELECT jsonb_build_object(
          'on_bus', COALESCE(SUM(CASE WHEN b.bus_id IS NOT NULL THEN 1 ELSE 0 END), 0),
          'in_car', COALESCE(SUM(CASE WHEN b.car_id IS NOT NULL THEN 1 ELSE 0 END), 0),
          'no_transport', COALESCE(SUM(CASE WHEN b.bus_id IS NULL AND b.car_id IS NULL THEN 1 ELSE 0 END), 0)
        )
        FROM public.bookings b
        WHERE b.trip_id = t.id AND b.cancelled_at IS NULL),
        '{"on_bus": 0, "in_car": 0, "no_transport": 0}'::jsonb
      ) as transport_breakdown,

      COALESCE(
        (SELECT jsonb_build_object(
          '0', COALESCE(SUM(CASE WHEN p.servants_needed = 0 THEN 1 ELSE 0 END), 0),
          '1', COALESCE(SUM(CASE WHEN p.servants_needed = 1 THEN 1 ELSE 0 END), 0),
          '2', COALESCE(SUM(CASE WHEN p.servants_needed = 2 THEN 1 ELSE 0 END), 0)
        )
        FROM public.bookings b
        JOIN public.profiles p ON p.id = b.user_id
        WHERE b.trip_id = t.id AND b.cancelled_at IS NULL AND p.deleted_at IS NULL
          AND b.family_member_id IS NULL),
        '{"0": 0, "1": 0, "2": 0}'::jsonb
      ) as servants_needed,

      COALESCE(
        (SELECT jsonb_build_object(
          'total_seats', COALESCE(SUM(bus.capacity), 0),
          'filled', COALESCE(SUM(CASE WHEN b.id IS NOT NULL THEN 1 ELSE 0 END), 0)
        )
        FROM public.buses bus
        LEFT JOIN public.bookings b ON b.bus_id = bus.id AND b.cancelled_at IS NULL
        WHERE bus.trip_id = t.id),
        '{"total_seats": 0, "filled": 0}'::jsonb
      ) as bus_stats,

      COALESCE(
        (SELECT jsonb_build_object(
          'total_capacity', COALESCE(SUM(r.capacity), 0),
          'assigned', (SELECT COUNT(*) FROM public.bookings WHERE trip_id = t.id AND cancelled_at IS NULL AND room_id IS NOT NULL)
        )
        FROM public.rooms r WHERE r.trip_id = t.id),
        '{"total_capacity": 0, "assigned": 0}'::jsonb
      ) as room_stats,

      (SELECT COUNT(*) FROM public.bookings b
       WHERE b.trip_id = t.id AND b.cancelled_at IS NULL) as total_booked
  ) stats
  ORDER BY t.trip_date DESC;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/00100_trip_only_and_dashboard.sql
git commit -m "feat: SQL migration for trip-only booking and advanced dashboard RPCs"
```

---

### Task 2: TypeScript Types + i18n Keys

**Files:**
- Modify: `src/lib/types/database.ts` — add `TripStats` type
- Modify: `src/lib/i18n/dictionaries/ar.json` — add new keys
- Modify: `src/lib/i18n/dictionaries/en.json` — add new keys

- [ ] **Step 1: Add `TripStats` type to `src/lib/types/database.ts`**

Append after the `AdminLog` type at the end of the file:

```typescript
export type TripStats = {
  trip_id: string;
  title_ar: string;
  title_en: string;
  trip_date: string;
  is_open: boolean;
  total_booked: number;
  total_registered: number;
  by_role: Record<string, number>;
  by_gender: { Male: number; Female: number };
  by_transport: Record<string, number>;
  wheelchair_count: number;
  family_members_count: number;
  by_sector: { name: string; count: number }[];
  transport_breakdown: { on_bus: number; in_car: number; no_transport: number };
  servants_needed: Record<string, number>;
  bus_stats: { total_seats: number; filled: number };
  room_stats: { total_capacity: number; assigned: number };
};
```

- [ ] **Step 2: Add new i18n keys to `src/lib/i18n/dictionaries/ar.json`**

Add these keys inside the `"trips"` section (after `"date"`):
```json
"bookTrip": "احجز الرحلة",
"bookTripFor": "احجز لـ {count} أشخاص",
"bookedNoBus": "تم الحجز! هيعينوا الأتوبيس بعدين."
```

Add these keys inside the `"buses"` section (after `"back"`):
```json
"bookWithoutBus": "احجز بدون اختيار أتوبيس",
"bookWithoutBusDesc": "هيتم تعيين أتوبيس بعدين"
```

Add these keys inside the `"admin"` section (after `"servantsNeeded"`):
```json
"noBusAssigned": "بدون أتوبيس",
"unassignedPassengers": "ركاب بدون أتوبيس",
"totalTrips": "إجمالي الرحلات",
"totalBookings": "إجمالي الحجوزات",
"totalWheelchairs": "كراسي متحركة",
"totalFamilyMembers": "أفراد العائلة",
"byRole": "حسب الدور",
"byGender": "حسب النوع",
"maleCount": "ذكور",
"femaleCount": "إناث",
"withWheelchair": "مع كرسي",
"withoutWheelchair": "بدون كرسي",
"transportBreakdown": "وسيلة النقل",
"onBus": "أتوبيس",
"inCar": "عربية",
"noTransport": "بدون نقل",
"bySector": "حسب القطاع",
"familyMembersCount": "أفراد العائلة",
"servantsNeededCount": "محتاجين خدمة",
"fillRate": "نسبة الامتلاء",
"openTrips": "رحلات مفتوحة",
"closedTrips": "رحلات مقفولة"
```

- [ ] **Step 3: Add new i18n keys to `src/lib/i18n/dictionaries/en.json`**

Add these keys inside the `"trips"` section (after `"date"`):
```json
"bookTrip": "Book Trip",
"bookTripFor": "Book for {count} people",
"bookedNoBus": "Booked! Admin will assign your bus later."
```

Add these keys inside the `"buses"` section (after `"back"`):
```json
"bookWithoutBus": "Book without choosing a bus",
"bookWithoutBusDesc": "A bus will be assigned later"
```

Add these keys inside the `"admin"` section (after `"servantsNeeded"`):
```json
"noBusAssigned": "No bus",
"unassignedPassengers": "Unassigned passengers",
"totalTrips": "Total Trips",
"totalBookings": "Total Bookings",
"totalWheelchairs": "Wheelchairs",
"totalFamilyMembers": "Family Members",
"byRole": "By Role",
"byGender": "By Gender",
"maleCount": "Male",
"femaleCount": "Female",
"withWheelchair": "With Wheelchair",
"withoutWheelchair": "Without Wheelchair",
"transportBreakdown": "Transport",
"onBus": "On Bus",
"inCar": "In Car",
"noTransport": "No Transport",
"bySector": "By Sector",
"familyMembersCount": "Family Members",
"servantsNeededCount": "Servants Needed",
"fillRate": "Fill Rate",
"openTrips": "Open Trips",
"closedTrips": "Closed Trips"
```

- [ ] **Step 4: Verify JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/lib/i18n/dictionaries/ar.json','utf8'));JSON.parse(require('fs').readFileSync('src/lib/i18n/dictionaries/en.json','utf8'));console.log('OK')"`

- [ ] **Step 5: Commit**

```bash
git add src/lib/types/database.ts src/lib/i18n/dictionaries/ar.json src/lib/i18n/dictionaries/en.json
git commit -m "feat: add TripStats type and i18n keys for trip-only booking + dashboard"
```

---

### Task 3: Trip-Only Booking on `/trips` Page

**Files:**
- Modify: `src/app/(authenticated)/trips/page.tsx`

- [ ] **Step 1: Add imports and state for family members**

At the top, update the import line for types:
```typescript
import type { Trip, Booking, FamilyMember } from "@/lib/types/database";
```

Add state variables after `cancellingId`:
```typescript
const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
const [selectedFamilyIds, setSelectedFamilyIds] = useState<Set<string>>(new Set());
const [bookingTripId, setBookingTripId] = useState<string | null>(null);
```

- [ ] **Step 2: Load family members in `loadData`**

Inside `loadData`, after the `bookingsRes` line, add family member loading in the same Promise.all:

Change the existing code from:
```typescript
const [tripsRes, bookingsRes] = await Promise.all([
```
To:
```typescript
const [tripsRes, bookingsRes, familyRes] = await Promise.all([
  supabase.from("trips").select("*").eq("is_open", true).order("trip_date", { ascending: false }),
  supabase
    .from("bookings")
    .select("*, trips(*), buses(area_name_ar, area_name_en), family_members(full_name)")
    .eq("user_id", user.id)
    .is("cancelled_at", null),
  supabase.rpc("get_family_members"),
]);
```

After `setMyBookings(...)`, add:
```typescript
setFamilyMembers((familyRes.data || []) as FamilyMember[]);
```

- [ ] **Step 3: Add `toggleFamilyMember` and `handleBookTrip` functions**

After `handleCancelBooking`, add:
```typescript
function toggleFamilyMember(id: string) {
  setSelectedFamilyIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
}

async function handleBookTrip(tripId: string) {
  const totalPeople = 1 + selectedFamilyIds.size;
  const msg = selectedFamilyIds.size > 0
    ? `${t("trips.bookTripFor", { count: totalPeople })}?`
    : `${t("trips.bookTrip")}?`;
  if (!confirm(msg)) return;

  setBookingTripId(tripId);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    router.push("/login");
    setBookingTripId(null);
    return;
  }

  const memberIds = Array.from(selectedFamilyIds);
  const { error } = memberIds.length > 0
    ? await supabase.rpc("book_trip_only_with_family", {
        p_user_id: user.id,
        p_trip_id: tripId,
        p_family_member_ids: memberIds,
      })
    : await supabase.rpc("book_trip_only", {
        p_user_id: user.id,
        p_trip_id: tripId,
      });

  setBookingTripId(null);

  if (error) {
    if (error.message.includes("Already booked")) {
      showToast(t("trips.alreadyBooked"), "error");
    } else {
      showToast(t("common.error"), "error");
    }
    return;
  }

  showToast(t("trips.bookedNoBus"), "success");
  setSelectedFamilyIds(new Set());
  loadData();
}
```

- [ ] **Step 4: Update the trip card UI — replace the booked/button section**

Find the `<div className="shrink-0">` block (around line 125-141) and replace it with:

```tsx
<div className="shrink-0 flex flex-col gap-2">
  {booked ? (
    <span className="badge-green">
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      {t("trips.alreadyBooked")}
    </span>
  ) : (
    <div className="flex flex-col gap-2">
      <button
        onClick={() => router.push(`/trips/${trip.id}/buses`)}
        className="btn-secondary w-full sm:w-auto"
      >
        {t("trips.bookNow")}
      </button>
      <button
        onClick={() => handleBookTrip(trip.id)}
        disabled={bookingTripId !== null}
        className="btn-primary w-full sm:w-auto"
      >
        {bookingTripId === trip.id ? t("common.loading") : t("trips.bookTrip")}
      </button>
    </div>
  )}
</div>
```

- [ ] **Step 5: Add family member selection UI above the trips list**

After the `<h1>` tag and before the `{trips.length === 0 ?` block, add:

```tsx
{familyMembers.length > 0 && !loading && (
  <div className="card mb-6 border-2 border-purple-200 dark:border-purple-800">
    <h3 className="text-sm font-bold text-slate-800 dark:text-gray-100 mb-3">{t("family.selectMembers")}</h3>
    <div className="flex flex-wrap gap-2">
      <span className="px-3 py-2 rounded-xl text-sm font-semibold border-2 min-h-[44px] inline-flex items-center gap-1.5 border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-400">
        {t("family.me")}
      </span>
      {familyMembers.map((fm) => (
        <button
          key={fm.id}
          type="button"
          onClick={() => toggleFamilyMember(fm.id)}
          className={`px-3 py-2 rounded-xl text-sm font-semibold border-2 min-h-[44px] inline-flex items-center gap-1.5 transition-all duration-150 active:scale-95 ${
            selectedFamilyIds.has(fm.id)
              ? "border-purple-500 bg-purple-50 text-purple-700 dark:border-purple-500 dark:bg-purple-950/50 dark:text-purple-400"
              : "border-slate-200 bg-white text-slate-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
          }`}
        >
          {fm.full_name}
          {fm.has_wheelchair && " ♿"}
          <span className={`text-xs ${fm.gender === "Male" ? "text-blue-500" : "text-pink-500"}`}>
            {fm.gender === "Male" ? "♂" : "♀"}
          </span>
        </button>
      ))}
    </div>
    {selectedFamilyIds.size > 0 && (
      <p className="text-xs text-slate-400 dark:text-gray-500 mt-2">
        {t("family.bookWith")}: 1 + {selectedFamilyIds.size} = {1 + selectedFamilyIds.size}
      </p>
    )}
  </div>
)}
```

- [ ] **Step 6: Verify build compiles**

Run: `npx next build 2>&1 | tail -5` (or `npx tsc --noEmit` for faster check)

- [ ] **Step 7: Commit**

```bash
git add src/app/\(authenticated\)/trips/page.tsx
git commit -m "feat: add trip-only booking button and family member selection to /trips page"
```

---

### Task 4: Trip-Only Booking on Bus Selection Page

**Files:**
- Modify: `src/app/(authenticated)/trips/[tripId]/buses/page.tsx`

- [ ] **Step 1: Add `handleBookTripOnly` function**

After `handleBookCar` (around line 215), add:

```typescript
async function handleBookTripOnly() {
  const totalPeople = 1 + selectedFamilyIds.size;
  const msg = selectedFamilyIds.size > 0
    ? `${t("buses.bookWithoutBus")} (${totalPeople})?`
    : `${t("buses.bookWithoutBus")}?`;
  if (!confirm(msg)) return;

  setBookingBusId("trip-only");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    router.push("/login");
    setBookingBusId(null);
    return;
  }

  const memberIds = Array.from(selectedFamilyIds);
  const { error } = memberIds.length > 0
    ? await supabase.rpc("book_trip_only_with_family", {
        p_user_id: user.id,
        p_trip_id: tripId,
        p_family_member_ids: memberIds,
      })
    : await supabase.rpc("book_trip_only", {
        p_user_id: user.id,
        p_trip_id: tripId,
      });

  if (error) {
    if (error.message.includes("Already booked")) {
      showToast(t("trips.alreadyBooked"), "error");
    } else {
      showToast(t("common.error"), "error");
    }
    setBookingBusId(null);
    return;
  }

  setConfirmation({
    tripTitle: trip ? (lang === "ar" ? trip.title_ar : trip.title_en) : "",
    busLabel: t("buses.bookWithoutBus"),
    leaderName: "-",
    tripDate: trip?.trip_date || "",
    totalBooked: totalPeople,
  });
}
```

- [ ] **Step 2: Add "Book without bus" card in the render**

After the family members card (after the closing `</div>` of the `{familyMembers.length > 0 && (` block, around line 323) and before the `{userHasCar && (` block, add:

```tsx
<div className="card mb-6 border-2 border-green-200 dark:border-green-800">
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
    <div>
      <h3 className="text-base font-bold text-slate-800 dark:text-gray-100">{t("buses.bookWithoutBus")}</h3>
      <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">{t("buses.bookWithoutBusDesc")}</p>
    </div>
    <button
      onClick={handleBookTripOnly}
      disabled={bookingBusId !== null}
      className="btn-primary w-full sm:w-auto"
    >
      {bookingBusId === "trip-only" ? t("common.loading") : t("trips.bookTrip")}
    </button>
  </div>
</div>
```

- [ ] **Step 3: Verify build compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/app/\(authenticated\)/trips/\[tripId\]/buses/page.tsx
git commit -m "feat: add 'book without bus' card on bus selection page"
```

---

### Task 5: Advanced Admin Dashboard

**Files:**
- Modify: `src/app/(authenticated)/admin/page.tsx` — full rewrite

- [ ] **Step 1: Rewrite the admin dashboard**

Replace the entire file content with:

```tsx
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { TripStats } from "@/lib/types/database";

type RoleBadge = {
  key: string;
  label: string;
  bg: string;
  text: string;
};

export default function AdminDashboard() {
  const { t, lang } = useTranslation();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [stats, setStats] = useState<TripStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("get_all_trips_stats");
      if (error) {
        console.error("[admin/dashboard] Failed:", error.message);
        return;
      }
      setStats((data || []) as TripStats[]);
    } catch {
      console.error("[admin/dashboard] Unexpected error");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return <LoadingSpinner text={t("common.loading")} />;
  }

  const totals = useMemo(() => {
    let totalBookings = 0;
    let totalWheelchairs = 0;
    let totalFamily = 0;
    let openTrips = 0;
    for (const s of stats) {
      totalBookings += s.total_booked;
      totalWheelchairs += s.wheelchair_count;
      totalFamily += s.family_members_count;
      if (s.is_open) openTrips++;
    }
    return { totalBookings, totalWheelchairs, totalFamily, openTrips, closedTrips: stats.length - openTrips };
  }, [stats]);

  const roleBadges: RoleBadge[] = [
    { key: "patient", label: t("admin.patient"), bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-400" },
    { key: "servant", label: t("admin.servant"), bg: "bg-green-50 dark:bg-green-950/30", text: "text-green-700 dark:text-green-400" },
    { key: "companion", label: t("admin.companion"), bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-400" },
    { key: "family_assistant", label: t("admin.familyAssistant"), bg: "bg-purple-50 dark:bg-purple-950/30", text: "text-purple-700 dark:text-purple-400" },
    { key: "trainee", label: t("admin.trainee"), bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-700 dark:text-orange-400" },
  ];

  function getStatusColor(percent: number) {
    if (percent >= 80) return "danger";
    if (percent >= 50) return "warning";
    return "";
  }

  function renderStatBox(label: string, value: string | number, bg: string, text: string) {
    return (
      <div className={`${bg} rounded-2xl p-4 text-center`}>
        <div className={`text-2xl font-bold ${text}`}>{value}</div>
        <div className="text-xs text-slate-400 dark:text-gray-500 mt-1">{label}</div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h1 className="section-title mb-6">{t("admin.dashboard")}</h1>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-6">
        {renderStatBox(t("admin.openTrips"), totals.openTrips, "bg-green-50 dark:bg-green-950/30", "text-green-700 dark:text-green-400")}
        {renderStatBox(t("admin.totalBookings"), totals.totalBookings, "bg-blue-50 dark:bg-blue-950/30", "text-blue-700 dark:text-blue-400")}
        {renderStatBox(t("admin.totalWheelchairs"), totals.totalWheelchairs, "bg-amber-50 dark:bg-amber-950/30", "text-amber-700 dark:text-amber-400")}
        {renderStatBox(t("admin.totalFamilyMembers"), totals.totalFamily, "bg-purple-50 dark:bg-purple-950/30", "text-purple-700 dark:text-purple-400")}
      </div>

      {stats.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-lg text-slate-400 dark:text-gray-500">{t("admin.noBusesYet")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {stats.map((s) => {
            const isExpanded = expandedId === s.trip_id;
            const title = lang === "ar" ? s.title_ar : s.title_en;
            const unbooked = s.total_registered - s.total_booked;

            return (
              <div key={s.trip_id} className="card">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : s.trip_id)}
                  className="w-full text-start flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-800 dark:text-gray-100">{title}</h2>
                      {s.is_open ? (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400">{t("admin.isOpen")}</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400">{t("admin.isClosed")}</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-400 dark:text-gray-500 mt-1">{s.trip_date}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">{s.total_booked}/{s.total_registered}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-gray-800 animate-slide-up">
                    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-4">
                      {renderStatBox(t("admin.totalBooked"), s.total_booked, "bg-blue-50 dark:bg-blue-950/30", "text-blue-700 dark:text-blue-400")}
                      {renderStatBox(t("admin.unbookedCount"), unbooked, "bg-red-50 dark:bg-red-950/30", "text-red-600 dark:text-red-400")}
                      {renderStatBox(t("admin.busSeatsFilled"), `${s.bus_stats.filled}/${s.bus_stats.total_seats}`, "bg-slate-50 dark:bg-gray-800", "text-slate-700 dark:text-gray-300")}
                      {renderStatBox(t("admin.roomsAssigned"), `${s.room_stats.assigned}/${s.room_stats.total_capacity}`, "bg-purple-50 dark:bg-purple-950/30", "text-purple-700 dark:text-purple-400")}
                    </div>

                    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 mb-4">
                      <div className="bg-slate-50 dark:bg-gray-800/50 rounded-2xl p-4">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300 mb-3">{t("admin.byRole")}</h3>
                        <div className="flex flex-wrap gap-2">
                          {roleBadges.map((rb) => {
                            const count = s.by_role[rb.key] || 0;
                            if (count === 0) return null;
                            return (
                              <span key={rb.key} className={`text-xs px-2.5 py-1 rounded-full font-medium ${rb.bg} ${rb.text}`}>
                                {rb.label}: {count}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      <div className="bg-slate-50 dark:bg-gray-800/50 rounded-2xl p-4">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300 mb-3">{t("admin.byGender")}</h3>
                        <div className="flex gap-3">
                          <span className="text-sm px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 font-medium">♂ {t("admin.maleCount")}: {s.by_gender.Male}</span>
                          <span className="text-sm px-3 py-1 rounded-full bg-pink-50 dark:bg-pink-950/30 text-pink-700 dark:text-pink-400 font-medium">♀ {t("admin.femaleCount")}: {s.by_gender.Female}</span>
                        </div>
                        <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300 mt-4 mb-3">♿ {t("admin.wheelchair")}</h3>
                        <div className="flex gap-3">
                          <span className="text-sm px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 font-medium">{t("admin.withWheelchair")}: {s.wheelchair_count}</span>
                          <span className="text-sm px-3 py-1 rounded-full bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-400 font-medium">{t("admin.withoutWheelchair")}: {s.total_booked - s.wheelchair_count}</span>
                        </div>
                      </div>

                      <div className="bg-slate-50 dark:bg-gray-800/50 rounded-2xl p-4">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300 mb-3">{t("admin.transportBreakdown")}</h3>
                        <div className="flex flex-wrap gap-2">
                          <span className="text-sm px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 font-medium">🚌 {t("admin.onBus")}: {s.transport_breakdown.on_bus}</span>
                          <span className="text-sm px-3 py-1 rounded-full bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 font-medium">🚗 {t("admin.inCar")}: {s.transport_breakdown.in_car}</span>
                          <span className="text-sm px-3 py-1 rounded-full bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-400 font-medium">🚶 {t("admin.noTransport")}: {s.transport_breakdown.no_transport}</span>
                        </div>
                      </div>

                      <div className="bg-slate-50 dark:bg-gray-800/50 rounded-2xl p-4">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300 mb-3">{t("admin.servantsNeededCount")}</h3>
                        <div className="flex gap-2">
                          <span className="text-sm px-3 py-1 rounded-full bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-400 font-medium">0: {s.servants_needed["0"] || 0}</span>
                          <span className="text-sm px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 font-medium">1: {s.servants_needed["1"] || 0}</span>
                          <span className="text-sm px-3 py-1 rounded-full bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 font-medium">2: {s.servants_needed["2"] || 0}</span>
                        </div>

                        <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300 mt-4 mb-3">👨‍👩‍👧 {t("admin.familyMembersCount")}</h3>
                        <p className="text-sm text-slate-600 dark:text-gray-400 font-medium">{s.family_members_count}</p>
                      </div>
                    </div>

                    {s.by_sector.length > 0 && (
                      <div className="bg-slate-50 dark:bg-gray-800/50 rounded-2xl p-4 mb-4">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300 mb-3">{t("admin.bySector")}</h3>
                        <div className="flex flex-wrap gap-2">
                          {s.by_sector.map((sec) => (
                            <span key={sec.name} className="text-xs px-2.5 py-1 rounded-full font-medium bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-400">
                              {sec.name}: {sec.count}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {s.bus_stats.total_seats > 0 && (
                      <div className="mb-4">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300 mb-3">{t("admin.fillRate")}</h3>
                        <div className="flex items-center gap-3">
                          <div className="progress-bar flex-1">
                            <div
                              className={`progress-bar-fill ${getStatusColor(s.bus_stats.filled / s.bus_stats.total_seats * 100)}`}
                              style={{ width: `${Math.min(s.bus_stats.filled / s.bus_stats.total_seats * 100, 100)}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold text-slate-600 dark:text-gray-400 shrink-0">
                            {s.bus_stats.filled}/{s.bus_stats.total_seats} ({Math.round(s.bus_stats.filled / s.bus_stats.total_seats * 100)}%)
                          </span>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => router.push(`/admin/trips/${s.trip_id}`)}
                      className="btn-primary w-full sm:w-auto"
                    >
                      {t("admin.manage")} →
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/app/\(authenticated\)/admin/page.tsx
git commit -m "feat: replace admin dashboard with advanced stats dashboard"
```

---

### Task 6: Admin OverviewTab — "No Bus" Stat + Unassigned in BusesTab

**Files:**
- Modify: `src/app/(authenticated)/admin/trips/[id]/OverviewTab.tsx`
- Modify: `src/app/(authenticated)/admin/trips/[id]/BusesTab.tsx`

- [ ] **Step 1: Add "No bus assigned" stat to OverviewTab**

In `OverviewTab.tsx`, add a new state variable after `roomsTotal`:
```typescript
const [noBusCount, setNoBusCount] = useState(0);
```

Inside `loadData`, after the `allBookings` variable, add:
```typescript
const noBus = allBookings.filter((b: { bus_id: string | null; car_id?: string | null }) => b.bus_id === null && (!b.car_id || b.car_id === null)).length;
setNoBusCount(noBus);
```

Note: the bookings query needs to also select `car_id`. Change the bookings select from:
```typescript
supabase.from("bookings").select("bus_id, room_id").eq("trip_id", tripId).is("cancelled_at", null),
```
To:
```typescript
supabase.from("bookings").select("bus_id, room_id, car_id").eq("trip_id", tripId).is("cancelled_at", null),
```

Add a new stat to the `stats` array:
```typescript
{ label: t("admin.noBusAssigned"), value: noBusCount, bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-700 dark:text-orange-400" },
```

- [ ] **Step 2: Add unassigned passengers section to BusesTab**

In `BusesTab.tsx`, after the buses loading logic (after `setBuses(busesWithPassengers)`), collect unassigned passengers:

Add state:
```typescript
const [unassigned, setUnassigned] = useState<Passenger[]>([]);
```

In `loadBuses`, after `setBuses(busesWithPassengers)`, add:
```typescript
const unassignedPsg = passengersByBus[""] || passengersByBus[null as unknown as string] || [];
const nullBusBookings = (bookingsRes.data || []).filter((b: { bus_id: string | null; car_id: string | null }) => b.bus_id === null && b.car_id === null);
const unassignedList: Passenger[] = [];
for (const b of nullBusBookings) {
  const p = b.profiles as unknown as { full_name: string; gender: string; has_wheelchair: boolean; sector_id: string | null };
  const fm = (b as { family_members?: { full_name: string; gender: string; has_wheelchair: boolean } | null }).family_members;
  const fmId = (b as { family_member_id?: string | null }).family_member_id || null;
  unassignedList.push({
    booking_id: b.id,
    user_id: b.user_id,
    full_name: fmId && fm ? fm.full_name : p.full_name,
    gender: fmId && fm ? fm.gender : p.gender,
    has_wheelchair: fmId && fm ? fm.has_wheelchair : p.has_wheelchair,
    sector_name: p.sector_id ? (sectorMap[p.sector_id] || "") : "",
    family_member_id: fmId,
  });
}
setUnassigned(unassignedList);
```

In the render, add before `{buses.length === 0 ?`:
```tsx
{unassigned.length > 0 && (
  <div className="card mb-4 border-2 border-orange-200 dark:border-orange-800">
    <h3 className="text-base font-bold text-slate-800 dark:text-gray-100 mb-3">
      {t("admin.unassignedPassengers")} ({unassigned.length})
    </h3>
    <div className="space-y-2">
      {unassigned.map((p) => (
        <div key={p.booking_id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 dark:bg-gray-800/50">
          <div className="flex items-center gap-2">
            {p.family_member_id && <span className="text-xs text-purple-400 dark:text-purple-500">↳</span>}
            <span className="text-sm font-medium text-slate-700 dark:text-gray-200">{p.full_name}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${p.gender === "Male" ? "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400" : "bg-pink-50 dark:bg-pink-950/30 text-pink-600 dark:text-pink-400"}`}>
              {p.gender === "Male" ? "♂" : "♀"}
            </span>
            {p.has_wheelchair && <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400">♿</span>}
            {p.sector_name && <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-400">{p.sector_name}</span>}
          </div>
          <div className="flex items-center gap-2">
            {buses.length > 0 && (
              <>
                {movingPassenger === p.booking_id ? (
                  <div className="flex items-center gap-2">
                    <select
                      className="input-field !py-1 !text-xs !w-auto min-w-[120px]"
                      value={selectedTargetBus}
                      onChange={(e) => setSelectedTargetBus(e.target.value)}
                    >
                      <option value="">{t("admin.selectBus")}</option>
                      {buses.map((ob) => (
                        <option key={ob.id} value={ob.id}>
                          {ob.bus_label || ob.area_name_ar} ({ob.passengers.length}/{ob.capacity})
                        </option>
                      ))}
                    </select>
                    <button onClick={confirmMove} disabled={!selectedTargetBus} className="px-2 py-1 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 active:scale-95 transition-all duration-150">
                      {t("admin.book")}
                    </button>
                    <button onClick={() => setMovingPassenger(null)} className="px-2 py-1 rounded-lg text-xs font-medium bg-slate-200 dark:bg-gray-700 text-slate-600 dark:text-gray-300 hover:bg-slate-300 dark:hover:bg-gray-600 active:scale-95 transition-all duration-150">
                      {t("admin.cancel")}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => startMove(p.booking_id)}
                    className="px-2 py-1 rounded-lg text-xs font-medium bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950/50 active:scale-95 transition-all duration-150"
                  >
                    {t("admin.moveToBus")}
                  </button>
                )}
                <button
                  onClick={() => handleRemovePassenger(p.booking_id, p.full_name)}
                  className="px-2 py-1 rounded-lg text-xs font-medium bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/50 active:scale-95 transition-all duration-150"
                >
                  {t("admin.removeFromBus")}
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 3: Verify build compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/app/\(authenticated\)/admin/trips/\[id\]/OverviewTab.tsx src/app/\(authenticated\)/admin/trips/\[id\]/BusesTab.tsx
git commit -m "feat: add no-bus stats and unassigned passengers section to admin"
```

---

### Task 7: Final Verification

- [ ] **Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`

Expected: 0 errors

- [ ] **Step 2: Run ESLint**

Run: `npx next lint`

Expected: 0 warnings

- [ ] **Step 3: Run build**

Run: `npx next build`

Expected: Build succeeds

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: resolve build issues from trip-only booking and dashboard features"
```
