# CTRMS: Areas, Rooms Redesign & Production Polish

**Date:** 2026-04-03
**Status:** Draft

## Problem Statement

The church trip management system needs three major improvements:

1. **No structured areas** — Area names are free text on each bus. No centralized management. Patients can't browse areas or see who else booked.
2. **Rooms are buried** — Room management is 3 clicks deep inside admin trip detail. The gender separation is clunky. Servants need a dedicated, streamlined rooms page.
3. **Not production-ready** — No bulk bus creation, no passenger visibility, inconsistent UX.

## Design Goals

- Simple, clean, professional — designed for ~40 concurrent elderly users (large touch targets, clear labels)
- Zero code errors, clean architecture, good performance
- Fully bilingual (AR/EN)
- All admins see the same real-time state (shared room assignments)

---

## 1. Areas System (Global, Reused Per Trip)

### 1.1 Database — New `areas` Table

```sql
CREATE TABLE public.areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar text NOT NULL,
  name_en text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read areas"
  ON public.areas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Servants can manage areas"
  ON public.areas FOR ALL TO authenticated
  USING (is_servant()) WITH CHECK (is_servant());
```

### 1.2 Database — Buses Table Changes

Add `area_id` FK and `bus_label` to buses:

```sql
ALTER TABLE public.buses ADD COLUMN area_id uuid REFERENCES public.areas(id) ON DELETE SET NULL;
ALTER TABLE public.buses ADD COLUMN bus_label text;
```

- `area_name_ar`/`area_name_en` remain as denormalized cache (copied from areas table on bus creation). This avoids joins on every read.
- `bus_label` is the display name (e.g., "Giza Bus 1"). Auto-generated on bulk creation, editable per bus.

### 1.3 TypeScript Types

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

Add to `Bus`: `area_id: string | null` and `bus_label: string | null`.

### 1.4 Admin Areas Page (`/admin/areas`)

Dedicated page for servants/super_admin to manage areas globally.

**Features:**
- List all areas sorted by `sort_order`
- Create area: `name_ar`, `name_en`, `sort_order`
- Edit area: same fields
- Toggle active/inactive (inactive areas don't appear in bus creation dropdowns but existing buses keep their data)
- Delete area: only if no buses reference it; otherwise show error toast
- Admin logging for all area operations

**Header nav:** New "Areas" button between "Trips" and "Reports" in the admin nav section.

### 1.5 Admin BusesTab — Bulk Bus Creation

Inside a trip detail (`/admin/trips/{id}` → Buses tab), the creation form changes:

**New form:**
1. **Area** — dropdown of active areas. When selected, auto-fills `area_name_ar`/`area_name_en`.
2. **Number of buses** — integer (default 1, min 1, max 20)
3. **Capacity per bus** — integer
4. **Leader name** — optional, applied to all buses in the batch

**On save:**
- Insert N buses with same `area_id`, area names, `capacity`, `leader_name`, `trip_id`
- Auto-generate `bus_label` for each: "{Area Name} Bus 1", "{Area Name} Bus 2", etc.
- Log `bulk_create_buses` with count

**Edit a single bus:** Shows `bus_label` (editable), `capacity`, `leader_name`. Area is read-only.

### 1.6 Patient Bus Booking — Area-Grouped with Passenger Names

The `/trips/{tripId}/buses` page is redesigned:

**Layout — grouped by area:**
```
┌─────────────────────────────────────────┐
│ Giza                                    │
│                                         │
│  ┌─ Giza Bus 1 ─────────────────────┐  │
│  │ Leader: John                     │  │
│  │ ████████░░  32/40                │  │
│  │ Passengers: Ahmed, Mohamed, ...  │  │
│  │                        [Choose]  │  │
│  └──────────────────────────────────┘  │
│                                         │
│  ┌─ Giza Bus 2 ─────────────────────┐  │
│  │ Leader: Mark                     │  │
│  │ ██████░░░░  24/40                │  │
│  │ Passengers: Sara, Mariam, ...    │  │
│  │                        [Choose]  │  │
│  └──────────────────────────────────┘  │
│                                         │
│ Haram                                   │
│  ┌─ Haram Bus 1 ────────────────────┐  │
│  │ Leader: Paul                     │  │
│  │ ████░░░░░░  15/40                │  │
│  │ Passengers: Youssef, ...         │  │
│  │                        [Choose]  │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

**Key behaviors:**
- Buses grouped under area headers (area name in current language)
- Each bus card shows: `bus_label`, leader name, capacity bar (green/yellow/red), **list of passenger full names**
- Full buses greyed out with "Full" badge — passenger names still visible
- Patient can browse ALL areas (not restricted to their own)
- Patient clicks "Choose" → same confirm dialog → `book_bus` RPC → confirmation screen
- If passenger list is long, show first 5 names + "+N more" with expand

**Data fetch optimization:**
- Single query: `buses` + `bookings(select: profiles(full_name))` for the trip
- Group by area in the frontend (no extra queries)

---

## 2. Rooms Navigation & Gender-Separated Tabs

### 2.1 Header Navigation

Add "Rooms" button in admin nav, placed after "Trips":

```
Dashboard | Trips | Areas | Rooms | Reports
```

- Links to `/admin/rooms`
- Visible to servants and super_admin

### 2.2 Dedicated Rooms Page (`/admin/rooms`)

New page with a **trip selector** at the top + **gender tabs** below.

**Page structure:**
```
┌─────────────────────────────────────────────┐
│ Select Trip: [▼ Easter Trip 2026    ]       │
│                                             │
│ [Boys]  [Girls]              + New Room     │
│ ─────────────────────────────────────────── │
│                                             │
│ Unassigned          │  Room: Boys Room 1    │
│ ┌─ Ahmed ─────────┐ │  Capacity: 54        │
│ │                 │ │  ┌─ Mohamed ────────┐ │
│ ├─ Youssef ───────┤ │  ├─ Ibrahim ───────┤ │
│ │                 │ │  ├─ Karim ─────────┤ │
│ ├─ Omar ──────────┤ │  │  ... 48/54      │ │
│ │                 │ │  └─────────────────┘ │
│ └─────────────────┘ │  [Assign Selected]    │
│                     │                       │
│                     │  Room: Boys Room 2    │
│                     │  Capacity: 30         │
│                     │  ...                  │
└─────────────────────────────────────────────┘
```

**Flow:**
1. Admin selects a trip from dropdown (defaults to most recent open trip)
2. Two gender tabs: **Boys** (Male) and **Girls** (Female)
3. Active tab determines which data is shown:
   - **Left panel — Unassigned people** of that gender who have a bus booking but no room
   - **Right panel — Rooms** of that gender with occupant list and capacity bar
4. Admin clicks a person in unassigned list to select them
5. Compatible rooms (same gender, has capacity) show "Assign" button
6. Admin clicks "Assign" → person moves to the room
7. Room card shows who's inside (full names) — visible to all admins in real-time

**Room creation form:**
- `room_label` (e.g., "Boys Room 1")
- `room_type` — auto-set based on active gender tab (no manual selection needed)
- `capacity` (e.g., 54)
- `supervisor_name` (optional)

**Key behaviors:**
- Gender tab auto-sets `room_type` on creation — admin doesn't have to pick it
- All admins see the same state (changes are reflected on reload)
- Room cards show: label, supervisor, occupant names, capacity bar
- "Remove from Room" button on each occupant to unassign them
- Room capacity bar shows fill level (same green/yellow/red pattern as buses)

### 2.3 Existing RoomsTab

The existing `RoomsTab` inside `/admin/trips/{id}` remains functional but is updated to match the new gender-tab design. The same component is reused in both locations (per-trip tab and dedicated page).

---

## 3. Production Polish

### 3.1 PDF Reports — Area-Aware

- Update `generate-report.ts` to use `bus_label` for bus display names
- Group buses by area in bus reports
- Room reports use gender-tab layout

### 3.2 Data Integrity

- Deleting an area with existing buses → blocked with error message
- Toggling area inactive → existing buses keep their data, area just hidden from new bus creation
- `bus_label` unique within a trip (unique index: `buses(trip_id, bus_label)`)
- `assign_room` RPC already validates gender match + capacity — no changes needed

### 3.3 Admin Logging

New actions logged:
- `create_area`, `edit_area`, `delete_area`, `toggle_area`
- `bulk_create_buses` (with count in details JSON)

### 3.4 i18n New Keys

**English (`en.json`):**
- `admin.areas` → "Areas"
- `admin.createArea` → "New Area"
- `admin.editArea` → "Edit Area"
- `admin.deleteArea` → "Delete Area"
- `admin.areaNameAr` → "Area Name (Arabic)"
- `admin.areaNameEn` → "Area Name (English)"
- `admin.numberOfBuses` → "Number of Buses"
- `admin.busLabel` → "Bus Label"
- `admin.areaActive` → "Active"
- `admin.areaInactive` → "Inactive"
- `admin.areaInUse` → "Cannot delete area — buses are assigned to it"
- `admin.roomsOverview` → "Rooms Overview"
- `admin.boysTab` → "Boys"
- `admin.girlsTab` → "Girls"
- `admin.selectTrip` → "Select Trip"
- `admin.passengers` → "Passengers"
- `admin.showMore` → "Show more"
- `admin.removeFromRoom` → "Remove from Room"
- `admin.noUnassigned` → "Everyone is assigned"

**Arabic (`ar.json`):**
- `admin.areas` → "المناطق"
- `admin.createArea` → "منطقة جديدة"
- `admin.editArea` → "تعديل المنطقة"
- `admin.deleteArea` → "مسح المنطقة"
- `admin.areaNameAr` → "اسم المنطقة بالعربي"
- `admin.areaNameEn` → "اسم المنطقة بالإنجليزي"
- `admin.numberOfBuses` → "عدد الأتوبيسات"
- `admin.busLabel` → "اسم الباص"
- `admin.areaActive` → "نشط"
- `admin.areaInactive` → "غير نشط"
- `admin.areaInUse` → "ممكن تمسش المنطقة — في اتوبيسات مربوطة بيها"
- `admin.roomsOverview` → "نظرة عامة على الأوض"
- `admin.boysTab` → "اولد"
- `admin.girlsTab` → "بنات"
- `admin.selectTrip` → "اختار الرحلة"
- `admin.passengers` → "الركاب"
- `admin.showMore` → "عرض المزيد"
- `admin.removeFromRoom` → "شيل من الأوضة"
- `admin.noUnassigned` → "كل الناس مخصصلهم"

---

## 4. Migration Strategy

Backward compatible. Existing buses without `area_id` continue to work.

**Migration order:**
1. Create `areas` table with RLS
2. Add `area_id` and `bus_label` columns to `buses`
3. Data migration: create areas from existing distinct `area_name_ar`/`area_name_en` pairs, link buses to them
4. Update TypeScript types
5. Build new UI components (Areas page, Rooms page, updated BusesTab, updated patient bus page)
6. Update Header nav
7. Update i18n dictionaries
8. Update PDF reports

---

## 5. Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `supabase/migrations/00012_create_areas.sql` | Areas table, bus columns, data migration |
| `src/app/(authenticated)/admin/areas/page.tsx` | Global areas management page |
| `src/app/(authenticated)/admin/rooms/page.tsx` | Dedicated rooms page with gender tabs + trip selector |

### Modified Files
| File | Changes |
|------|---------|
| `src/lib/types/database.ts` | Add `Area` type, update `Bus` with `area_id` + `bus_label` |
| `src/components/Header.tsx` | Add "Areas" and "Rooms" nav buttons |
| `src/app/(authenticated)/admin/trips/[id]/BusesTab.tsx` | Area dropdown, bulk creation, bus_label |
| `src/app/(authenticated)/admin/trips/[id]/RoomsTab.tsx` | Gender-tab redesign |
| `src/app/(authenticated)/trips/[tripId]/buses/page.tsx` | Area-grouped layout with passenger names |
| `src/lib/i18n/dictionaries/en.json` | New translation keys |
| `src/lib/i18n/dictionaries/ar.json` | New translation keys |
| `src/lib/pdf/generate-report.ts` | Area-aware bus reports |
