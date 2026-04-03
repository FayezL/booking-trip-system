# UX/UI Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify the admin UX by removing redundant pages, adding a trip overview dashboard, inline area names, better empty states, and renaming "patient" to "makhdom" in display text.

**Architecture:** All changes are frontend-only (no database migrations). Remove 2 pages (Areas, Rooms overview), modify 6 existing files, create 1 new component (OverviewTab). i18n strings updated for rename and new labels.

**Tech Stack:** Next.js 14 App Router, Supabase client, Tailwind CSS, i18n with JSON dictionaries.

---

### Task 1: Update i18n strings

**Files:**
- Modify: `src/lib/i18n/dictionaries/ar.json`
- Modify: `src/lib/i18n/dictionaries/en.json`

- [ ] **Step 1: Update ar.json** — Rename مريض→مخدوم, add new keys for overview, empty states, manage button, area name input

Key changes in ar.json:
- `"patient": "مخدوم"`
- `"registerPatient": "سجّل مخدوم جديد"`
- Add: `"manage": "إدارة"`, `"areaName": "اسم المنطقة"`, `"overview": "نظرة عامة"`, `"totalBooked": "إجمالي المحجوزين"`, `"noBusesYet": "مفيش اتوبيسات لسه"`, `"noRoomsYet": "مفيش أوض لسه"`, `"addBusesFirst": "ضيف اتوبيسات عشان الناس تقدر تحجز"`, `"addRoomsFirst": "ضيف أوض عشان تخصص ناس"`, `"bookingSoon": "الحجز هيكون متاح قريب"`, `"backToTrips": "ارجع للرحلات"`

- [ ] **Step 2: Update en.json** — Mirror changes in English

Key changes in en.json:
- `"patient": "Makhdom"`
- `"registerPatient": "Register New Makhdom"`
- Add matching English keys for all new Arabic keys

- [ ] **Step 3: Verify JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/lib/i18n/dictionaries/ar.json','utf8'));JSON.parse(require('fs').readFileSync('src/lib/i18n/dictionaries/en.json','utf8'));console.log('OK')"`

---

### Task 2: Delete redundant pages

**Files:**
- Delete: `src/app/(authenticated)/admin/areas/page.tsx`
- Delete: `src/app/(authenticated)/admin/rooms/page.tsx`

- [ ] **Step 1: Delete areas page**

Run: `rm src/app/\(authenticated\)/admin/areas/page.tsx`

- [ ] **Step 2: Delete rooms page**

Run: `rm src/app/\(authenticated\)/admin/rooms/page.tsx`

---

### Task 3: Simplify Header navigation

**Files:**
- Modify: `src/components/Header.tsx`

- [ ] **Step 1: Remove Areas and Rooms nav buttons from Header**

In `src/components/Header.tsx`, remove the two nav buttons for Areas (`/admin/areas`) and Rooms (`/admin/rooms`). Keep: Dashboard, Trips, Reports, Users, Logs.

The remaining nav buttons should be:
- Dashboard (`/admin`)
- Trips (`/admin/trips`)
- Reports (`/admin/reports`)
- Users (`/admin/users`) — super_admin only
- Logs (`/admin/logs`) — super_admin only

---

### Task 4: Add Manage button to admin trips list + back link on trip detail

**Files:**
- Modify: `src/app/(authenticated)/admin/trips/page.tsx`
- Modify: `src/app/(authenticated)/admin/trips/[id]/page.tsx`

- [ ] **Step 1: Add Manage button to each trip row in trips list**

In `src/app/(authenticated)/admin/trips/page.tsx`, add a "Manage" button (using `t("admin.manage")`) to each trip's button group, linking to `/admin/trips/${trip.id}`. Place it as the first button before Edit and Delete. Style: `bg-emerald-100 text-emerald-700 hover:bg-emerald-200`.

- [ ] **Step 2: Add back link to trip detail page**

In `src/app/(authenticated)/admin/trips/[id]/page.tsx`, add a "← Back to Trips" link (using `t("admin.backToTrips")`) at the top before the trip title, similar to the user-facing buses page pattern. Navigate to `/admin/trips`.

---

### Task 5: Modify BusesTab — single area name input

**Files:**
- Modify: `src/app/(authenticated)/admin/trips/[id]/BusesTab.tsx`

- [ ] **Step 1: Replace area dropdown with single text input**

In `BusesTab.tsx`:
- Remove `areas` state and `loadAreas()` function
- Remove Area import from types
- In the create form: replace the `<select>` dropdown with a single text input for area name (label: `t("admin.areaName")`)
- In `handleSave()` for creating: use the input value for both `area_name_ar` and `area_name_en`
- Remove `area_id` from the bus insert payload
- In edit mode: keep bus_label and capacity fields only (area name not editable after creation)
- Remove `form.area_id` from BusForm type, add `area_name: string` instead
- Buses are still displayed grouped by area name (existing logic works since `area_name_ar` and `area_name_en` will be the same value)

---

### Task 6: Create OverviewTab component

**Files:**
- Create: `src/app/(authenticated)/admin/trips/[id]/OverviewTab.tsx`

- [ ] **Step 1: Create OverviewTab with stats cards and area summary**

The component receives `tripId` and `onSwitchTab` as props.

**Data loading:** Fetch in parallel:
- `buses` for this trip (id, area_name_ar, area_name_en, capacity, bus_label)
- `bookings` for this trip where cancelled_at is null (bus_id, room_id, user_id)
- Total registered users count from profiles

**Stats cards (4-card grid):**
1. Total Booked — active booking count — emerald bg
2. Unbooked — total registered - booked — red bg
3. Bus Seats — filled/total — blue bg
4. Rooms — assigned/total — purple bg

**Areas summary:**
Group buses by `area_name_ar`. For each area:
- Area name heading
- "X buses" count
- Seats filled/total with progress bar
- Bus labels listed inline
- Color: green (<50%), yellow (50-80%), red (>80%)

**Quick actions:**
- "Add Buses" button → calls `onSwitchTab("buses")`
- "Register & Book" button → calls `onSwitchTab("unbooked")`

---

### Task 7: Update trip detail page — integrate Overview + empty states + color coding

**Files:**
- Modify: `src/app/(authenticated)/admin/trips/[id]/page.tsx`
- Modify: `src/app/(authenticated)/admin/trips/[id]/BusesTab.tsx`

- [ ] **Step 1: Add Overview tab to trip detail page**

In `page.tsx`:
- Import OverviewTab
- Add "overview" to Tab type
- Set default activeTab to "overview"
- Add overview tab button to tabs array with label `t("admin.overview")`
- Render `<OverviewTab tripId={tripId} onSwitchTab={setActiveTab} />` when active
- Pass `setActiveTab` as the `onSwitchTab` prop

- [ ] **Step 2: Add better empty states to BusesTab**

In `BusesTab.tsx`:
- When buses list is empty, show: `t("admin.noBusesYet")` message + `t("admin.addBusesFirst")` description + the "Add Bus" button (already exists)
- Use the same styling pattern as the trips page empty state

- [ ] **Step 3: Add color-coded status badges to BusesTab**

In `BusesTab.tsx`:
- Apply consistent color coding to bus progress bars (already partially done)
- Add a text badge next to bus name: green "Available" if <50%, yellow "Almost Full" if 50-80%, red "Full" if >80%
- Same logic in OverviewTab area cards

---

### Task 8: Fix Unbooked tab performance

**Files:**
- Modify: `src/app/(authenticated)/admin/trips/[id]/UnbookedTab.tsx`

- [ ] **Step 1: Optimize the data loading query**

In `UnbookedTab.tsx`, the `loadData()` function currently loads ALL profiles then filters in JS. Fix:

1. First get booked user IDs for this trip
2. Then query profiles excluding those IDs: `.select("*").not("id", "in", `(${bookedIds.join(",")})`)
3. This moves filtering to the database level

The existing `loadData` function should be refactored from:
```
load all profiles → filter in JS
```
to:
```
load booked user IDs → query profiles NOT IN those IDs
```

---

### Task 9: Update user-facing empty state

**Files:**
- Modify: `src/app/(authenticated)/trips/[tripId]/buses/page.tsx`

- [ ] **Step 1: Change "no buses" message for users**

When `areaGroups.length === 0`, show `t("admin.bookingSoon")` instead of `t("trips.noTrips")`. This is the message users see when a trip exists but has no buses configured yet.

---

### Task 10: Verify and commit

- [ ] **Step 1: Run lint and typecheck**

Run: `npx next lint && npx tsc --noEmit`

- [ ] **Step 2: Verify the app builds**

Run: `npm run build`

- [ ] **Step 3: Commit all changes**

Commit with message: "feat: UX overhaul — overview tab, inline areas, rename مريض→مخدوم, remove redundant pages"
