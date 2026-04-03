# CTRMS: Areas, Rooms Redesign & Production Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add structured areas with bulk bus creation, a dedicated rooms page with gender tabs, passenger name visibility, and production polish.

**Architecture:** Global `areas` table reused across trips. Buses link to areas via FK with denormalized name cache. New `/admin/areas` and `/admin/rooms` pages. Patient bus booking grouped by area showing passenger names. Rooms page uses Boys/Girls tabs.

**Tech Stack:** Next.js 14.2, React 18, TypeScript, Supabase (PostgreSQL), Tailwind CSS 3.4, pdf-lib

**Spec:** `docs/superpowers/specs/2026-04-03-areas-rooms-nav-production-polish-design.md`

---

### Task 1: Database Migration — Areas Table + Bus Columns

**Files:**
- Create: `supabase/migrations/00012_create_areas.sql`

- [ ] **Step 1: Write the migration SQL**

Create the migration file with:

1. `areas` table: `id` (uuid PK), `name_ar` (text NOT NULL), `name_en` (text NOT NULL), `is_active` (boolean NOT NULL DEFAULT true), `sort_order` (int NOT NULL DEFAULT 0), `created_at` (timestamptz DEFAULT now())
2. Enable RLS on `areas`
3. RLS policy: authenticated users can SELECT; servants can do ALL (using `is_servant()`)
4. Add `area_id uuid REFERENCES public.areas(id) ON DELETE SET NULL` to `buses`
5. Add `bus_label text` to `buses`
6. Unique index: `idx_buses_unique_label_per_trip ON buses(trip_id, bus_label) WHERE bus_label IS NOT NULL`
7. Data migration: INSERT INTO areas distinct pairs from buses' `area_name_ar`/`area_name_en`, then UPDATE buses SET area_id to the matching area
8. Unique constraint on areas: `UNIQUE(name_ar, name_en)` to prevent duplicate areas

```sql
CREATE TABLE public.areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar text NOT NULL,
  name_en text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(name_ar, name_en)
);

ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read areas"
  ON public.areas FOR SELECT TO authenticated USING (true);

CREATE POLICY "Servants can manage areas"
  ON public.areas FOR ALL TO authenticated
  USING (is_servant()) WITH CHECK (is_servant());

ALTER TABLE public.buses ADD COLUMN area_id uuid REFERENCES public.areas(id) ON DELETE SET NULL;
ALTER TABLE public.buses ADD COLUMN bus_label text;

CREATE UNIQUE INDEX idx_buses_unique_label_per_trip
  ON public.buses(trip_id, bus_label) WHERE bus_label IS NOT NULL;

INSERT INTO public.areas (name_ar, name_en)
SELECT DISTINCT b.area_name_ar, b.area_name_en
FROM public.buses b
ON CONFLICT (name_ar, name_en) DO NOTHING;

UPDATE public.buses b
SET area_id = a.id
FROM public.areas a
WHERE b.area_name_ar = a.name_ar AND b.area_name_en = a.name_en AND b.area_id IS NULL;
```

- [ ] **Step 2: Verify migration file is valid SQL**

No syntax errors. All referenced tables/columns exist.

---

### Task 2: TypeScript Types + i18n Dictionaries

**Files:**
- Modify: `src/lib/types/database.ts`
- Modify: `src/lib/i18n/dictionaries/en.json`
- Modify: `src/lib/i18n/dictionaries/ar.json`

- [ ] **Step 1: Add Area type to database.ts**

After the existing `Profile` type, add:

```ts
export type Area = {
  id: string;
  name_ar: string;
  name_en: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};
```

Update the `Bus` type to include two new fields:

```ts
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
```

- [ ] **Step 2: Update en.json**

Add these keys inside the `"admin"` object (before the closing `}`):

```json
"areas": "Areas",
"createArea": "New Area",
"editArea": "Edit Area",
"deleteArea": "Delete Area",
"areaNameAr": "Area Name (Arabic)",
"areaNameEn": "Area Name (English)",
"areaActive": "Active",
"areaInactive": "Inactive",
"areaInUse": "Cannot delete area — buses are assigned to it",
"numberOfBuses": "Number of Buses",
"busLabel": "Bus Label",
"roomsOverview": "Rooms Overview",
"boysTab": "Boys",
"girlsTab": "Girls",
"passengersList": "Passengers",
"showMore": "Show more",
"removeFromRoom": "Remove from Room",
"noUnassigned": "Everyone is assigned",
"assignRoom": "Assign to Room",
"sortOrder": "Sort Order",
"toggleActive": "Toggle Active"
```

- [ ] **Step 3: Update ar.json**

Add these keys inside the `"admin"` object (before the closing `}`):

```json
"areas": "المناطق",
"createArea": "منطقة جديدة",
"editArea": "تعديل المنطقة",
"deleteArea": "مسح المنطقة",
"areaNameAr": "اسم المنطقة بالعربي",
"areaNameEn": "اسم المنطقة بالإنجليزي",
"areaActive": "نشط",
"areaInactive": "غير نشط",
"areaInUse": "ممكن تمسش المنطقة — في اتوبيسات مربوطة بيها",
"numberOfBuses": "عدد الأتوبيسات",
"busLabel": "اسم الباص",
"roomsOverview": "نظرة عامة على الأوض",
"boysTab": "اولد",
"girlsTab": "بنات",
"passengersList": "الركاب",
"showMore": "عرض المزيد",
"removeFromRoom": "شيل من الأوضة",
"noUnassigned": "كل الناس مخصصلهم",
"assignRoom": "خصّص أوضة",
"sortOrder": "ترتيب",
"toggleActive": "تفعيل/إلغاء"
```

- [ ] **Step 4: Run build to verify no type errors**

Run: `npm run build`
Expected: Build succeeds with no TypeScript errors.

---

### Task 3: Admin Areas Page (`/admin/areas`)

**Files:**
- Create: `src/app/(authenticated)/admin/areas/page.tsx`

- [ ] **Step 1: Create the Areas management page**

This is a "use client" component following the same patterns as `/admin/trips/page.tsx`.

**Features to implement:**
- List all areas in cards, sorted by `sort_order` then `created_at`
- Each area card shows: `name_ar`, `name_en`, active/inactive badge, sort order
- Create button ("+ New Area") opens an inline form
- Form fields: `name_ar` (required), `name_en` (required), `sort_order` (number, default 0)
- Edit button on each card opens the same form pre-filled
- Delete button — calls `supabase.from("buses").select("id").eq("area_id", id).limit(1)` first. If buses exist, show `t("admin.areaInUse")` error toast. Otherwise delete.
- Toggle active/inactive button — updates `is_active` on the area
- Admin logging for all operations
- Loading spinner while fetching
- Follow existing patterns: use `createClient()`, `useTranslation()`, `useToast()`, `logAction()`

**Page layout pattern** (same style as existing admin pages):
```tsx
"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useToast } from "@/components/Toast";
import LoadingSpinner from "@/components/LoadingSpinner";
import { logAction } from "@/lib/admin-logs";
import type { Area } from "@/lib/types/database";
// ... component follows BusesTab.tsx patterns
```

- [ ] **Step 2: Run build to verify**

Run: `npm run build`

---

### Task 4: Header Navigation Update

**Files:**
- Modify: `src/components/Header.tsx`

- [ ] **Step 1: Add "Areas" and "Rooms" nav buttons**

In the admin `<nav>` section (line 42-77), add two new buttons:

After the "Trips" button (line 53) and before the "Reports" button (line 55), add:

```tsx
<button
  onClick={() => router.push("/admin/areas")}
  className="px-3 py-1.5 text-sm font-medium rounded-md hover:bg-gray-100 transition-colors"
>
  {t("admin.areas")}
</button>
<button
  onClick={() => router.push("/admin/rooms")}
  className="px-3 py-1.5 text-sm font-medium rounded-md hover:bg-gray-100 transition-colors"
>
  {t("admin.rooms")}
</button>
```

The nav order becomes: Dashboard | Trips | Areas | Rooms | Reports

"Areas" and "Rooms" are visible to all servants+ (not super_admin only).

- [ ] **Step 2: Run build to verify**

Run: `npm run build`

---

### Task 5: BusesTab — Bulk Bus Creation with Area Dropdown

**Files:**
- Modify: `src/app/(authenticated)/admin/trips/[id]/BusesTab.tsx`

- [ ] **Step 1: Update BusesTab with area dropdown and bulk creation**

**Changes to make:**

1. **Import Area type**: Add `Area` to the import from `@/lib/types/database`

2. **New state**: `areas: Area[]` (loaded on mount), `busCount: number` (default 1)

3. **Update BusForm type**:
```ts
type BusForm = {
  area_id: string;
  area_name_ar: string;
  area_name_en: string;
  capacity: number;
  leader_name: string;
  bus_label: string;
  bus_count: number;
};
```

4. **Load areas on mount**: In the existing `useEffect`, also fetch `supabase.from("areas").select("*").eq("is_active", true).order("sort_order")`

5. **Update the form UI** — replace the 4-field form with:
   - **Area dropdown**: `<select>` of active areas. On change, auto-fill `area_name_ar`/`area_name_en` from selected area. On create mode only.
   - **Bus Label**: `<input>` — only shown in edit mode. Pre-filled with existing label.
   - **Number of buses**: `<input type="number" min="1" max="20">` — only shown in create mode. Default 1.
   - **Capacity**: same as before
   - **Leader name**: same as before

6. **Update handleSave for bulk creation**:
   - **Edit mode** (existing): same as before, update the single bus
   - **Create mode**: Loop `bus_count` times. For each bus:
     - Generate `bus_label`: `{area_name} Bus {i+1}` (use `lang === "ar" ? area_name_ar : area_name_en`)
     - Check if label already exists for this trip. If so, append number suffix.
     - Insert into `buses` with `trip_id`, `area_id`, `area_name_ar`, `area_name_en`, `capacity`, `leader_name`, `bus_label`
   - Use `supabase.from("buses").insert([...array of bus objects...])` for single bulk insert
   - Log `bulk_create_buses` with count in details

7. **Update bus cards display**: Show `bus.bus_label || (lang === "ar" ? bus.area_name_ar : bus.area_name_en)` as the title instead of just area name.

8. **Update startEdit**: Pre-fill form with `bus.area_id`, `bus.bus_label`, etc.

- [ ] **Step 2: Run build to verify**

Run: `npm run build`

---

### Task 6: Patient Bus Booking — Area-Grouped with Passenger Names

**Files:**
- Modify: `src/app/(authenticated)/trips/[tripId]/buses/page.tsx`

- [ ] **Step 1: Update patient bus booking page**

**Changes to make:**

1. **Update data fetching**: Instead of just fetching buses and booking counts, also fetch passenger names:
```ts
const [tripRes, busesRes, bookingsRes] = await Promise.all([
  supabase.from("trips").select("*").eq("id", tripId).single(),
  supabase.from("buses").select("*").eq("trip_id", tripId),
  supabase.from("bookings")
    .select("bus_id, profiles(full_name)")
    .eq("trip_id", tripId)
    .is("cancelled_at", null),
]);
```

2. **Update BusWithCount type**:
```ts
type BusWithCount = Bus & {
  booking_count: number;
  passengers: string[];
};
```

3. **Group passengers by bus_id** in the data loading:
```ts
const passengersByBus: Record<string, string[]> = {};
for (const b of bookingsRes.data || []) {
  const list = passengersByBus[b.bus_id] || [];
  if (b.profiles) list.push((b.profiles as { full_name: string }).full_name);
  passengersByBus[b.bus_id] = list;
}
```

4. **Group buses by area_id** for display. Buses with same `area_id` go under one area header. For buses without `area_id` (old data), group under their area name.

5. **Update the rendering** to show area-grouped layout:
   - Each area section: area name as header, then bus cards underneath
   - Each bus card shows: `bus_label` (or area name fallback), leader, capacity bar, **passenger names list**
   - Passenger names: show all names comma-separated. If > 5, show first 5 + "+N more" expandable link
   - Full buses: same greyed out style, names still visible

6. **Update handleBook**: Use `bus.bus_label || areaName` in the confirm dialog and confirmation screen instead of just `areaName`.

- [ ] **Step 2: Run build to verify**

Run: `npm run build`

---

### Task 7: RoomsTab — Gender Tabs Redesign

**Files:**
- Modify: `src/app/(authenticated)/admin/trips/[id]/RoomsTab.tsx`

- [ ] **Step 1: Redesign RoomsTab with Boys/Girls tabs**

**Changes to make:**

1. **Add gender tab state**: `const [genderTab, setGenderTab] = useState<"Male" | "Female">("Male")`

2. **Filter rooms and unassigned by gender tab**:
   - `filteredRooms = rooms.filter(r => r.room_type === genderTab)`
   - `filteredUnassigned = unassigned.filter(b => b.profiles.gender === genderTab)`

3. **Add tab buttons** at the top (same style as the existing trip detail tabs):
```tsx
<div className="flex gap-2 mb-4">
  <button onClick={() => setGenderTab("Male")} className={genderTab === "Male" ? activeTabClass : inactiveTabClass}>
    {t("admin.boysTab")}
  </button>
  <button onClick={() => setGenderTab("Female")} className={genderTab === "Female" ? activeTabClass : inactiveTabClass}>
    {t("admin.girlsTab")}
  </button>
</div>
```

4. **Room creation form**: Remove the `room_type` dropdown. Auto-set `room_type` from the active `genderTab`:
```ts
const formToSave = { ...form, room_type: genderTab };
```

5. **Room cards**: Show occupant names (already done), add "Remove" button per occupant that calls `supabase.from("bookings").update({ room_id: null }).eq("id", bookingId)`.

6. **Layout**: Keep the two-panel layout (unassigned left, rooms right) but filter by gender tab.

- [ ] **Step 2: Run build to verify**

Run: `npm run build`

---

### Task 8: Dedicated Rooms Page (`/admin/rooms`)

**Files:**
- Create: `src/app/(authenticated)/admin/rooms/page.tsx`

- [ ] **Step 1: Create the rooms overview page**

This page wraps the room management functionality with a trip selector at the top.

**Structure:**
```tsx
"use client";
import { useState, useEffect } from "react";
// ... same imports as other admin pages

export default function RoomsOverviewPage() {
  const { t } = useTranslation();
  const supabase = createClient();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Load trips on mount
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("trips")
        .select("*")
        .order("trip_date", { ascending: false });
      setTrips(data || []);
      // Default to first open trip
      const firstOpen = (data || []).find((t: Trip) => t.is_open);
      if (firstOpen) setSelectedTrip(firstOpen.id);
      setLoading(false);
    }
    load();
  }, []);

  // Render: trip selector + RoomsTab component
  return (
    <div>
      <h1>{t("admin.roomsOverview")}</h1>
      {/* Trip selector dropdown */}
      {/* Render RoomsTab if trip selected */}
    </div>
  );
}
```

**Key points:**
- Trip selector dropdown at top
- When a trip is selected, render `<RoomsTab tripId={selectedTrip} />` (import from the existing component)
- This reuses the exact same RoomsTab (which now has gender tabs from Task 7)
- Keep it simple — just the dropdown + the tab component

- [ ] **Step 2: Run build to verify**

Run: `npm run build`

---

### Task 9: Update UnbookedTab for Area-Aware Bus Display

**Files:**
- Modify: `src/app/(authenticated)/admin/trips/[id]/UnbookedTab.tsx`

- [ ] **Step 1: Update bus dropdown to show bus_label**

In the register form (line 228-233) and booking form (line 257-261), update the bus option display to use `bus_label`:

Change from:
```tsx
{lang === "ar" ? bus.area_name_ar : bus.area_name_en}
```

To:
```tsx
{bus.bus_label || (lang === "ar" ? bus.area_name_ar : bus.area_name_en)}
```

Apply this change in both places (register form bus dropdown + book-for-user bus dropdown).

- [ ] **Step 2: Run build to verify**

Run: `npm run build`

---

### Task 10: PDF Reports — Area-Aware Updates

**Files:**
- Modify: `src/lib/pdf/generate-report.ts`

- [ ] **Step 1: Update generateBusReportPDF to use bus_label and group by area**

In the bus report loop (line 85-117):

1. Change `bus.area_name_ar` display to `bus.bus_label || bus.area_name_ar`
2. Group buses by `area_id` (or `area_name_ar` for old data) before the loop
3. Add area section headers before each group

For the grouping, add before the loop:
```ts
const grouped = new Map<string, Bus[]>();
for (const bus of buses) {
  const key = bus.area_id || bus.area_name_ar;
  const group = grouped.get(key) || [];
  group.push(bus);
  grouped.set(key, group);
}
```

Then loop through groups instead of flat buses.

4. Update the Bus type import to include `area_id` and `bus_label` (already done in Task 2).

- [ ] **Step 2: Run build to verify**

Run: `npm run build`

---

### Task 11: Final Build Verification + Lint

**Files:** None (verification only)

- [ ] **Step 1: Run full build**

Run: `npm run build`
Expected: All pages compile successfully, no TypeScript errors.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No lint errors.

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: All existing tests pass (no regressions).
