# Phase 4: Servant Admin UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the servant (admin) UI — dashboard with trip stats, trip CRUD management, trip detail hub with buses/rooms/unbooked tabs, and reports page.

**Architecture:** All admin pages live under `src/app/(authenticated)/admin/` sharing the authenticated layout with Header. The trip detail hub (`/admin/trips/[id]`) uses client-side tab navigation between Buses, Rooms, and Unbooked views. CRUD operations use Supabase client directly. Room assignment uses the `assign_room` RPC. The unbooked tab uses the `register_and_book` RPC for creating patients + booking in one step.

**Tech Stack:** Next.js 14 App Router, Tailwind CSS, Supabase (Client), TypeScript

**Prerequisites:**
- All Phase 2 and Phase 3 files exist
- `src/app/(authenticated)/layout.tsx` — authenticated layout with Header
- `src/components/Toast.tsx` — toast notifications
- `src/lib/i18n/useTranslation.ts` — returns `{ t, lang }`
- `src/lib/supabase/client.ts` — browser Supabase client
- `src/lib/types/database.ts` — Profile, Trip, Bus, Room, Booking types
- RPC functions: `register_and_book`, `assign_room`, `cancel_booking`

---

### Task 18: Admin Dashboard page

**Files:**
- Create: `src/app/(authenticated)/admin/page.tsx`

- [ ] **Step 1: Create admin dashboard**

Create `src/app/(authenticated)/admin/page.tsx`:

```typescript
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { Trip } from "@/lib/types/database";

type TripStats = {
  trip: Trip;
  totalRegistered: number;
  bookedCount: number;
  unbookedCount: number;
  busSeatsFilled: number;
  busSeatsTotal: number;
  roomsAssigned: number;
  bookingTotal: number;
};

export default function AdminDashboard() {
  const { t, lang } = useTranslation();
  const router = useRouter();
  const supabase = createClient();

  const [stats, setStats] = useState<TripStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      const { data: trips } = await supabase
        .from("trips")
        .select("*")
        .order("trip_date", { ascending: false });

      if (!trips) {
        setLoading(false);
        return;
      }

      const tripStats: TripStats[] = [];

      for (const trip of trips) {
        const [profilesRes, busesRes, roomsRes] = await Promise.all([
          supabase.from("profiles").select("id", { count: "exact", head: true }),
          supabase.from("buses").select("capacity").eq("trip_id", trip.id),
          supabase.from("rooms").select("capacity").eq("trip_id", trip.id),
        ]);

        const totalRegistered = profilesRes.count || 0;
        const totalBusCapacity = (busesRes.data || []).reduce((sum, b) => sum + b.capacity, 0);
        const totalRoomCapacity = (roomsRes.data || []).reduce((sum, r) => sum + r.capacity, 0);

        const [bookingsRes, roomBookingsRes] = await Promise.all([
          supabase
            .from("bookings")
            .select("bus_id", { count: "exact" })
            .eq("trip_id", trip.id)
            .is("cancelled_at", null),
          supabase
            .from("bookings")
            .select("room_id", { count: "exact" })
            .eq("trip_id", trip.id)
            .is("cancelled_at", null)
            .not("room_id", "is", null),
        ]);

        const bookedCount = new Set((bookingsRes.data || []).map((b) => b.bus_id)).size;
        const busSeatsFilled = bookingsRes.count || 0;
        const roomsAssigned = roomBookingsRes.count || 0;

        tripStats.push({
          trip,
          totalRegistered,
          bookedCount: bookingsRes.count || 0,
          unbookedCount: totalRegistered - (bookingsRes.count || 0),
          busSeatsFilled,
          busSeatsTotal: totalBusCapacity,
          roomsAssigned,
          bookingTotal: totalRoomCapacity,
        });
      }

      setStats(tripStats);
      setLoading(false);
    }

    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-xl text-gray-500">{t("common.loading")}</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t("admin.dashboard")}</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <div
            key={s.trip.id}
            className="card cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => router.push(`/admin/trips/${s.trip.id}`)}
          >
            <h2 className="text-xl font-bold mb-3">
              {lang === "ar" ? s.trip.title_ar : s.trip.title_en}
            </h2>
            <p className="text-sm text-gray-500 mb-3">{s.trip.trip_date}</p>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-gray-50 rounded-lg p-2 text-center">
                <div className="font-bold text-lg">{s.totalRegistered}</div>
                <div className="text-gray-500">{t("admin.totalRegistered")}</div>
              </div>
              <div className="bg-emerald-50 rounded-lg p-2 text-center">
                <div className="font-bold text-lg text-emerald-700">{s.bookedCount}</div>
                <div className="text-gray-500">{t("admin.bookedCount")}</div>
              </div>
              <div className="bg-red-50 rounded-lg p-2 text-center">
                <div className="font-bold text-lg text-red-700">{s.unbookedCount}</div>
                <div className="text-gray-500">{t("admin.unbookedCount")}</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-2 text-center">
                <div className="font-bold text-lg text-blue-700">
                  {s.busSeatsFilled}/{s.busSeatsTotal}
                </div>
                <div className="text-gray-500">{t("admin.busSeatsFilled")}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add admin dashboard with trip statistics cards"
```

---

### Task 19: Trip Management page (CRUD)

**Files:**
- Create: `src/app/(authenticated)/admin/trips/page.tsx`

- [ ] **Step 1: Create trip management page**

Create `src/app/(authenticated)/admin/trips/page.tsx`:

```typescript
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useToast } from "@/components/Toast";
import type { Trip } from "@/lib/types/database";

type TripForm = {
  title_ar: string;
  title_en: string;
  trip_date: string;
  is_open: boolean;
};

const emptyForm: TripForm = {
  title_ar: "",
  title_en: "",
  trip_date: "",
  is_open: true,
};

export default function TripsManagementPage() {
  const { t, lang } = useTranslation();
  const supabase = createClient();
  const { showToast } = useToast();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TripForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTrips();
  }, []);

  async function loadTrips() {
    const { data } = await supabase
      .from("trips")
      .select("*")
      .order("trip_date", { ascending: false });
    setTrips(data || []);
    setLoading(false);
  }

  function startEdit(trip: Trip) {
    setEditingId(trip.id);
    setForm({
      title_ar: trip.title_ar,
      title_en: trip.title_en,
      trip_date: trip.trip_date,
      is_open: trip.is_open,
    });
    setShowForm(true);
  }

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.title_ar || !form.title_en || !form.trip_date) {
      showToast(t("common.error"), "error");
      return;
    }

    setSaving(true);

    if (editingId) {
      const { error } = await supabase
        .from("trips")
        .update(form)
        .eq("id", editingId);
      if (error) {
        showToast(t("common.error"), "error");
      } else {
        showToast(t("admin.editTrip"), "success");
      }
    } else {
      const { error } = await supabase.from("trips").insert(form);
      if (error) {
        showToast(t("common.error"), "error");
      } else {
        showToast(t("admin.createTrip"), "success");
      }
    }

    setSaving(false);
    setShowForm(false);
    loadTrips();
  }

  async function handleDelete(id: string) {
    if (!confirm(t("admin.confirmDelete"))) return;

    const { error } = await supabase.from("trips").delete().eq("id", id);
    if (error) {
      showToast(t("common.error"), "error");
    } else {
      showToast(t("admin.deleteTrip"), "success");
      loadTrips();
    }
  }

  async function toggleOpen(trip: Trip) {
    const { error } = await supabase
      .from("trips")
      .update({ is_open: !trip.is_open })
      .eq("id", trip.id);
    if (!error) loadTrips();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-xl text-gray-500">{t("common.loading")}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t("admin.trips")}</h1>
        <button onClick={startCreate} className="btn-primary">
          + {t("admin.createTrip")}
        </button>
      </div>

      {showForm && (
        <div className="card mb-6">
          <h2 className="text-xl font-bold mb-4">
            {editingId ? t("admin.editTrip") : t("admin.createTrip")}
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label-text">{t("admin.tripTitleAr")}</label>
              <input
                className="input-field"
                value={form.title_ar}
                onChange={(e) => setForm({ ...form, title_ar: e.target.value })}
              />
            </div>
            <div>
              <label className="label-text">{t("admin.tripTitleEn")}</label>
              <input
                className="input-field"
                value={form.title_en}
                onChange={(e) => setForm({ ...form, title_en: e.target.value })}
                dir="ltr"
              />
            </div>
            <div>
              <label className="label-text">{t("admin.tripDate")}</label>
              <input
                type="date"
                className="input-field"
                value={form.trip_date}
                onChange={(e) => setForm({ ...form, trip_date: e.target.value })}
                dir="ltr"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => toggleOpen({ ...form, id: editingId || "" } as Trip)}
                className={`px-4 py-3 rounded-lg font-semibold min-h-[48px] ${
                  form.is_open
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-gray-200 text-gray-600"
                }`}
                disabled={!editingId}
              >
                {form.is_open ? t("admin.isOpen") : t("admin.isClosed")}
              </button>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? t("common.loading") : t("admin.save")}
            </button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">
              {t("admin.cancel")}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {trips.map((trip) => (
          <div key={trip.id} className="card">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">
                  {lang === "ar" ? trip.title_ar : trip.title_en}
                </h3>
                <p className="text-sm text-gray-500">{trip.trip_date}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleOpen(trip)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                    trip.is_open
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {trip.is_open ? t("admin.isOpen") : t("admin.isClosed")}
                </button>
                <button
                  onClick={() => startEdit(trip)}
                  className="px-3 py-1.5 rounded-md text-sm font-medium bg-blue-100 text-blue-700 hover:bg-blue-200"
                >
                  {t("admin.edit")}
                </button>
                <button
                  onClick={() => handleDelete(trip.id)}
                  className="px-3 py-1.5 rounded-md text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200"
                >
                  {t("admin.delete")}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add trip management CRUD page for admin"
```

---

### Task 20: Trip Detail Hub with tabs

**Files:**
- Create: `src/app/(authenticated)/admin/trips/[id]/page.tsx`

- [ ] **Step 1: Create trip detail hub with 3 tabs**

Create `src/app/(authenticated)/admin/trips/[id]/page.tsx`:

```typescript
"use client";

import { useState, useEffect, use } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import BusesTab from "./BusesTab";
import RoomsTab from "./RoomsTab";
import UnbookedTab from "./UnbookedTab";
import type { Trip } from "@/lib/types/database";

type Tab = "buses" | "rooms" | "unbooked";

export default function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: tripId } = use(params);
  const { t, lang } = useTranslation();
  const supabase = createClient();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("buses");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTrip() {
      const { data } = await supabase
        .from("trips")
        .select("*")
        .eq("id", tripId)
        .single();
      setTrip(data);
      setLoading(false);
    }
    loadTrip();
  }, [tripId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-xl text-gray-500">{t("common.loading")}</p>
      </div>
    );
  }

  if (!trip) {
    return <p className="text-center py-20 text-gray-500">{t("common.error")}</p>;
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "buses", label: t("admin.buses") },
    { key: "rooms", label: t("admin.rooms") },
    { key: "unbooked", label: t("admin.unbooked") },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">
        {lang === "ar" ? trip.title_ar : trip.title_en}
      </h1>
      <p className="text-gray-500 mb-4">{trip.trip_date}</p>

      <div className="flex gap-2 mb-6 border-b border-gray-200 pb-0">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-lg font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "buses" && <BusesTab tripId={tripId} />}
      {activeTab === "rooms" && <RoomsTab tripId={tripId} />}
      {activeTab === "unbooked" && <UnbookedTab tripId={tripId} />}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Build will fail because BusesTab, RoomsTab, UnbookedTab don't exist yet. That's expected — they'll be created in Tasks 21-23. Skip build verification for now.

- [ ] **Step 3: Do NOT commit yet (depends on Tasks 21-23)**

---

### Task 21: Buses Tab component

**Files:**
- Create: `src/app/(authenticated)/admin/trips/[id]/BusesTab.tsx`

- [ ] **Step 1: Create BusesTab component**

Create `src/app/(authenticated)/admin/trips/[id]/BusesTab.tsx`:

```typescript
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useToast } from "@/components/Toast";
import type { Bus } from "@/lib/types/database";

type BusWithCount = Bus & { booking_count: number };

type BusForm = {
  area_name_ar: string;
  area_name_en: string;
  capacity: number;
  leader_name: string;
};

const emptyForm: BusForm = {
  area_name_ar: "",
  area_name_en: "",
  capacity: 0,
  leader_name: "",
};

export default function BusesTab({ tripId }: { tripId: string }) {
  const { t, lang } = useTranslation();
  const supabase = createClient();
  const { showToast } = useToast();

  const [buses, setBuses] = useState<BusWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BusForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadBuses();
  }, [tripId]);

  async function loadBuses() {
    const { data: busList } = await supabase
      .from("buses")
      .select("*")
      .eq("trip_id", tripId);

    const busesWithCounts = await Promise.all(
      (busList || []).map(async (bus) => {
        const { count } = await supabase
          .from("bookings")
          .select("*", { count: "exact", head: true })
          .eq("bus_id", bus.id)
          .is("cancelled_at", null);
        return { ...bus, booking_count: count || 0 };
      })
    );

    setBuses(busesWithCounts);
    setLoading(false);
  }

  function startEdit(bus: Bus) {
    setEditingId(bus.id);
    setForm({
      area_name_ar: bus.area_name_ar,
      area_name_en: bus.area_name_en,
      capacity: bus.capacity,
      leader_name: bus.leader_name || "",
    });
    setShowForm(true);
  }

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.area_name_ar || !form.area_name_en || form.capacity <= 0) {
      showToast(t("common.error"), "error");
      return;
    }

    setSaving(true);

    if (editingId) {
      const { error } = await supabase
        .from("buses")
        .update(form)
        .eq("id", editingId);
      if (error) showToast(t("common.error"), "error");
      else showToast(t("admin.editBus"), "success");
    } else {
      const { error } = await supabase
        .from("buses")
        .insert({ ...form, trip_id: tripId });
      if (error) showToast(t("common.error"), "error");
      else showToast(t("admin.createBus"), "success");
    }

    setSaving(false);
    setShowForm(false);
    loadBuses();
  }

  async function handleDelete(id: string) {
    if (!confirm(t("admin.confirmDelete"))) return;
    const { error } = await supabase.from("buses").delete().eq("id", id);
    if (error) showToast(t("common.error"), "error");
    else {
      showToast(t("admin.deleteBus"), "success");
      loadBuses();
    }
  }

  if (loading) {
    return <p className="text-center py-10 text-gray-500">{t("common.loading")}</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">{t("admin.buses")}</h2>
        <button onClick={startCreate} className="btn-primary">
          + {t("admin.createBus")}
        </button>
      </div>

      {showForm && (
        <div className="card mb-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label-text">{t("admin.areaNameAr")}</label>
              <input
                className="input-field"
                value={form.area_name_ar}
                onChange={(e) => setForm({ ...form, area_name_ar: e.target.value })}
              />
            </div>
            <div>
              <label className="label-text">{t("admin.areaNameEn")}</label>
              <input
                className="input-field"
                value={form.area_name_en}
                onChange={(e) => setForm({ ...form, area_name_en: e.target.value })}
                dir="ltr"
              />
            </div>
            <div>
              <label className="label-text">{t("admin.capacity")}</label>
              <input
                type="number"
                className="input-field"
                value={form.capacity || ""}
                onChange={(e) => setForm({ ...form, capacity: parseInt(e.target.value) || 0 })}
                dir="ltr"
              />
            </div>
            <div>
              <label className="label-text">{t("admin.leaderName")}</label>
              <input
                className="input-field"
                value={form.leader_name}
                onChange={(e) => setForm({ ...form, leader_name: e.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? t("common.loading") : t("admin.save")}
            </button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">
              {t("admin.cancel")}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {buses.map((bus) => {
          const percent = bus.capacity > 0 ? (bus.booking_count / bus.capacity) * 100 : 0;
          return (
            <div key={bus.id} className="card">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-lg font-bold">
                    {lang === "ar" ? bus.area_name_ar : bus.area_name_en}
                  </h3>
                  {bus.leader_name && (
                    <p className="text-sm text-gray-500">
                      {t("admin.leaderName")}: {bus.leader_name}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => startEdit(bus)}
                    className="px-3 py-1.5 rounded-md text-sm font-medium bg-blue-100 text-blue-700 hover:bg-blue-200"
                  >
                    {t("admin.edit")}
                  </button>
                  <button
                    onClick={() => handleDelete(bus.id)}
                    className="px-3 py-1.5 rounded-md text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200"
                  >
                    {t("admin.delete")}
                  </button>
                </div>
              </div>
              <div className="flex justify-between text-sm text-gray-500 mb-1">
                <span>{t("admin.passengers")}: {bus.booking_count}/{bus.capacity}</span>
                <span>{Math.round(percent)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.min(percent, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Do NOT commit yet**

---

### Task 22: Rooms Tab component with room assignment

**Files:**
- Create: `src/app/(authenticated)/admin/trips/[id]/RoomsTab.tsx`

- [ ] **Step 1: Create RoomsTab component**

Create `src/app/(authenticated)/admin/trips/[id]/RoomsTab.tsx`:

```typescript
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useToast } from "@/components/Toast";
import type { Room, Booking, Profile } from "@/lib/types/database";

type RoomForm = {
  room_type: "Male" | "Female";
  capacity: number;
  supervisor_name: string;
  room_label: string;
};

const emptyForm: RoomForm = {
  room_type: "Male",
  capacity: 0,
  supervisor_name: "",
  room_label: "",
};

type BookingWithProfile = Booking & { profiles: Profile };
type RoomWithCount = Room & { occupant_count: number };

export default function RoomsTab({ tripId }: { tripId: string }) {
  const { t, lang } = useTranslation();
  const supabase = createClient();
  const { showToast } = useToast();

  const [rooms, setRooms] = useState<RoomWithCount[]>([]);
  const [unassigned, setUnassigned] = useState<BookingWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RoomForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [tripId]);

  async function loadData() {
    const [roomsRes, bookingsRes] = await Promise.all([
      supabase.from("rooms").select("*").eq("trip_id", tripId),
      supabase
        .from("bookings")
        .select("*, profiles(*)")
        .eq("trip_id", tripId)
        .is("cancelled_at", null)
        .is("room_id", null),
    ]);

    const roomList = (roomsRes.data || []) as Room[];
    const roomsWithCounts = await Promise.all(
      roomList.map(async (room) => {
        const { count } = await supabase
          .from("bookings")
          .select("*", { count: "exact", head: true })
          .eq("room_id", room.id)
          .is("cancelled_at", null);
        return { ...room, occupant_count: count || 0 };
      })
    );

    setRooms(roomsWithCounts);
    setUnassigned((bookingsRes.data || []) as unknown as BookingWithProfile[]);
    setLoading(false);
  }

  function startEdit(room: Room) {
    setEditingId(room.id);
    setForm({
      room_type: room.room_type,
      capacity: room.capacity,
      supervisor_name: room.supervisor_name || "",
      room_label: room.room_label,
    });
    setShowForm(true);
  }

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.room_label || form.capacity <= 0) {
      showToast(t("common.error"), "error");
      return;
    }

    setSaving(true);

    if (editingId) {
      const { error } = await supabase
        .from("rooms")
        .update(form)
        .eq("id", editingId);
      if (error) showToast(t("common.error"), "error");
      else showToast(t("admin.editRoom"), "success");
    } else {
      const { error } = await supabase
        .from("rooms")
        .insert({ ...form, trip_id: tripId });
      if (error) showToast(t("common.error"), "error");
      else showToast(t("admin.createRoom"), "success");
    }

    setSaving(false);
    setShowForm(false);
    loadData();
  }

  async function handleDelete(id: string) {
    if (!confirm(t("admin.confirmDelete"))) return;
    const { error } = await supabase.from("rooms").delete().eq("id", id);
    if (error) showToast(t("common.error"), "error");
    else {
      showToast(t("admin.deleteRoom"), "success");
      loadData();
    }
  }

  async function handleAssign(bookingId: string, roomId: string) {
    const { error } = await supabase.rpc("assign_room", {
      p_booking_id: bookingId,
      p_room_id: roomId,
    });

    if (error) {
      showToast(error.message, "error");
    } else {
      showToast(t("admin.assignRoom"), "success");
      setSelectedBooking(null);
      loadData();
    }
  }

  if (loading) {
    return <p className="text-center py-10 text-gray-500">{t("common.loading")}</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">{t("admin.rooms")}</h2>
        <button onClick={startCreate} className="btn-primary">
          + {t("admin.createRoom")}
        </button>
      </div>

      {showForm && (
        <div className="card mb-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label-text">{t("admin.roomType")}</label>
              <select
                className="input-field"
                value={form.room_type}
                onChange={(e) =>
                  setForm({ ...form, room_type: e.target.value as "Male" | "Female" })
                }
              >
                <option value="Male">{t("auth.male")}</option>
                <option value="Female">{t("auth.female")}</option>
              </select>
            </div>
            <div>
              <label className="label-text">{t("admin.roomLabel")}</label>
              <input
                className="input-field"
                value={form.room_label}
                onChange={(e) => setForm({ ...form, room_label: e.target.value })}
              />
            </div>
            <div>
              <label className="label-text">{t("admin.capacity")}</label>
              <input
                type="number"
                className="input-field"
                value={form.capacity || ""}
                onChange={(e) => setForm({ ...form, capacity: parseInt(e.target.value) || 0 })}
                dir="ltr"
              />
            </div>
            <div>
              <label className="label-text">{t("admin.supervisorName")}</label>
              <input
                className="input-field"
                value={form.supervisor_name}
                onChange={(e) => setForm({ ...form, supervisor_name: e.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? t("common.loading") : t("admin.save")}
            </button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">
              {t("admin.cancel")}
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="text-lg font-bold mb-3">{t("admin.unassigned")}</h3>
          <div className="space-y-2">
            {unassigned.length === 0 ? (
              <p className="text-gray-500 text-center py-4">{t("admin.noBookings")}</p>
            ) : (
              unassigned.map((b) => (
                <div
                  key={b.id}
                  onClick={() => setSelectedBooking(b.id)}
                  className={`card cursor-pointer transition-colors ${
                    selectedBooking === b.id
                      ? "ring-2 ring-emerald-500"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{b.profiles.full_name}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        b.profiles.gender === "Male"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-pink-100 text-pink-700"
                      }`}
                    >
                      {b.profiles.gender === "Male" ? t("auth.male") : t("auth.female")}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-bold mb-3">{t("admin.rooms")}</h3>
          <div className="space-y-2">
            {rooms.map((room) => {
              const canAssign =
                selectedBooking &&
                room.occupant_count < room.capacity &&
                unassigned.find((b) => b.id === selectedBooking)?.profiles.gender === room.room_type;

              return (
                <div key={room.id} className="card">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-bold">{room.room_label}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ms-2 ${
                          room.room_type === "Male"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-pink-100 text-pink-700"
                        }`}
                      >
                        {room.room_type === "Male" ? t("auth.male") : t("auth.female")}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(room)}
                        className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-700"
                      >
                        {t("admin.edit")}
                      </button>
                      <button
                        onClick={() => handleDelete(room.id)}
                        className="px-2 py-1 rounded text-xs bg-red-100 text-red-700"
                      >
                        {t("admin.delete")}
                      </button>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {room.occupant_count}/{room.capacity} {t("admin.occupants")}
                    {room.supervisor_name && ` — ${room.supervisor_name}`}
                  </div>
                  {canAssign && (
                    <button
                      onClick={() => handleAssign(selectedBooking, room.id)}
                      className="btn-primary mt-2 w-full text-sm py-1.5"
                    >
                      {t("admin.assignRoom")}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Do NOT commit yet**

---

### Task 23: Unbooked Tab component with register patient

**Files:**
- Create: `src/app/(authenticated)/admin/trips/[id]/UnbookedTab.tsx`

- [ ] **Step 1: Create UnbookedTab component**

Create `src/app/(authenticated)/admin/trips/[id]/UnbookedTab.tsx`:

```typescript
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useToast } from "@/components/Toast";
import type { Profile, Bus } from "@/lib/types/database";

type RegisterForm = {
  phone: string;
  full_name: string;
  gender: "Male" | "Female";
  password: string;
  bus_id: string;
};

const emptyForm: RegisterForm = {
  phone: "",
  full_name: "",
  gender: "Male",
  password: "",
  bus_id: "",
};

export default function UnbookedTab({ tripId }: { tripId: string }) {
  const { t, lang } = useTranslation();
  const supabase = createClient();
  const { showToast } = useToast();

  const [unbooked, setUnbooked] = useState<Profile[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState<"" | "Male" | "Female">("");
  const [showRegister, setShowRegister] = useState(false);
  const [form, setForm] = useState<RegisterForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [tripId]);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const allBookedRes = await supabase
      .from("bookings")
      .select("user_id")
      .eq("trip_id", tripId)
      .is("cancelled_at", null);

    const bookedIds = new Set((allBookedRes.data || []).map((b) => b.user_id));

    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .neq("id", user.id)
      .order("full_name");

    const unbookedProfiles = (profiles || []).filter((p) => !bookedIds.has(p.id));
    setUnbooked(unbookedProfiles);

    const { data: busList } = await supabase
      .from("buses")
      .select("*")
      .eq("trip_id", tripId);
    setBuses(busList || []);

    setLoading(false);
  }

  async function handleBookForUser(userId: string) {
    const { data: busList } = await supabase
      .from("buses")
      .select("*")
      .eq("trip_id", tripId);

    if (!busList || busList.length === 0) {
      showToast(t("common.error"), "error");
      return;
    }

    const { error } = await supabase.from("bookings").insert({
      user_id: userId,
      trip_id: tripId,
      bus_id: busList[0].id,
    });

    if (error) {
      showToast(t("common.error"), "error");
    } else {
      showToast(t("admin.book"), "success");
      loadData();
    }
  }

  async function handleRegister() {
    if (!form.phone || !form.full_name || !form.password) {
      showToast(t("common.error"), "error");
      return;
    }

    setSaving(true);

    const { data, error } = await supabase.rpc("register_and_book", {
      p_phone: form.phone,
      p_full_name: form.full_name,
      p_gender: form.gender,
      p_password: form.password,
      p_trip_id: form.bus_id ? tripId : null,
      p_bus_id: form.bus_id || null,
    });

    setSaving(false);

    if (error) {
      if (error.message.includes("already registered") || error.message.includes("unique")) {
        showToast(t("auth.phoneExists"), "error");
      } else {
        showToast(error.message, "error");
      }
      return;
    }

    showToast(t("admin.registerPatient"), "success");
    setShowRegister(false);
    setForm(emptyForm);
    loadData();
  }

  const filtered = unbooked.filter((p) => {
    const matchesSearch = !search || p.full_name.includes(search);
    const matchesGender = !genderFilter || p.gender === genderFilter;
    return matchesSearch && matchesGender;
  });

  const maleCount = unbooked.filter((p) => p.gender === "Male").length;
  const femaleCount = unbooked.filter((p) => p.gender === "Female").length;

  if (loading) {
    return <p className="text-center py-10 text-gray-500">{t("common.loading")}</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold">{t("admin.unbooked")}</h2>
          <p className="text-sm text-gray-500">
            {unbooked.length} {t("admin.unbooked")} ({maleCount}M, {femaleCount}F)
          </p>
        </div>
        <button onClick={() => setShowRegister(!showRegister)} className="btn-primary">
          + {t("admin.registerPatient")}
        </button>
      </div>

      {showRegister && (
        <div className="card mb-4">
          <h3 className="text-lg font-bold mb-3">{t("admin.registerPatient")}</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label-text">{t("auth.phone")}</label>
              <input
                className="input-field"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="01XXXXXXXXX"
                dir="ltr"
              />
            </div>
            <div>
              <label className="label-text">{t("auth.fullName")}</label>
              <input
                className="input-field"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>
            <div>
              <label className="label-text">{t("auth.gender")}</label>
              <select
                className="input-field"
                value={form.gender}
                onChange={(e) =>
                  setForm({ ...form, gender: e.target.value as "Male" | "Female" })
                }
              >
                <option value="Male">{t("auth.male")}</option>
                <option value="Female">{t("auth.female")}</option>
              </select>
            </div>
            <div>
              <label className="label-text">{t("auth.password")}</label>
              <input
                type="password"
                className="input-field"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                dir="ltr"
              />
            </div>
            <div className="md:col-span-2">
              <label className="label-text">{t("buses.chooseBus")} ({t("admin.cancel")})</label>
              <select
                className="input-field"
                value={form.bus_id}
                onChange={(e) => setForm({ ...form, bus_id: e.target.value })}
              >
                <option value="">— {t("admin.cancel")} —</option>
                {buses.map((bus) => (
                  <option key={bus.id} value={bus.id}>
                    {lang === "ar" ? bus.area_name_ar : bus.area_name_en}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handleRegister} disabled={saving} className="btn-primary">
              {saving ? t("common.loading") : t("admin.registerPatient")}
            </button>
            <button onClick={() => setShowRegister(false)} className="btn-secondary">
              {t("admin.cancel")}
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-3 mb-4">
        <input
          className="input-field max-w-xs"
          placeholder={t("admin.searchByName")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-1">
          {(["", "Male", "Female"] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGenderFilter(g)}
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                genderFilter === g
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {g === "" ? t("admin.all") : g === "Male" ? t("auth.male") : t("auth.female")}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-gray-500 text-center py-4">{t("admin.noBookings")}</p>
        ) : (
          filtered.map((p) => (
            <div key={p.id} className="card">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{p.full_name}</span>
                  <span className="text-sm text-gray-500 ms-2" dir="ltr">{p.phone}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ms-2 ${
                      p.gender === "Male"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-pink-100 text-pink-700"
                    }`}
                  >
                    {p.gender === "Male" ? t("auth.male") : t("auth.female")}
                  </span>
                </div>
                <button
                  onClick={() => handleBookForUser(p.id)}
                  className="btn-primary text-sm py-1.5 px-3"
                >
                  {t("admin.book")}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build (now that all tab components exist)**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add trip detail hub with buses, rooms, and unbooked tabs"
```

---

### Task 24: Reports page

**Files:**
- Create: `src/app/(authenticated)/admin/reports/page.tsx`

- [ ] **Step 1: Create reports page**

Create `src/app/(authenticated)/admin/reports/page.tsx`:

```typescript
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useToast } from "@/components/Toast";
import type { Trip, Bus, Room, Booking, Profile } from "@/lib/types/database";

export default function ReportsPage() {
  const { t, lang } = useTranslation();
  const supabase = createClient();
  const { showToast } = useToast();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<string>("");
  const [reportType, setReportType] = useState<"bus" | "room" | null>(null);
  const [reportData, setReportData] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    async function loadTrips() {
      const { data } = await supabase
        .from("trips")
        .select("*")
        .order("trip_date", { ascending: false });
      setTrips(data || []);
      setLoading(false);
    }
    loadTrips();
  }, []);

  async function generateReport(type: "bus" | "room") {
    if (!selectedTrip) {
      showToast(t("admin.selectTrip"), "error");
      return;
    }

    setReportType(type);
    setGenerating(true);

    const trip = trips.find((t) => t.id === selectedTrip);
    if (!trip) {
      setGenerating(false);
      return;
    }

    if (type === "bus") {
      const { data: buses } = await supabase
        .from("buses")
        .select("*")
        .eq("trip_id", selectedTrip);

      let report = `=== ${t("admin.busReport")} ===\n`;
      report += `${lang === "ar" ? trip.title_ar : trip.title_en} — ${trip.trip_date}\n\n`;

      for (const bus of buses || []) {
        const areaName = lang === "ar" ? bus.area_name_ar : bus.area_name_en;
        report += `--- ${areaName} ---\n`;
        report += `${t("admin.leaderName")}: ${bus.leader_name || "-"}\n`;
        report += `${t("admin.capacity")}: ${bus.capacity}\n`;

        const { data: bookings } = await supabase
          .from("bookings")
          .select("user_id")
          .eq("bus_id", bus.id)
          .is("cancelled_at", null);

        const userIds = (bookings || []).map((b) => b.user_id);
        report += `${t("admin.passengers")} (${userIds.length}):\n`;

        if (userIds.length > 0) {
          const { data: passengers } = await supabase
            .from("profiles")
            .select("full_name, phone, gender")
            .in("id", userIds);

          for (const p of passengers || []) {
            report += `  - ${p.full_name} (${p.phone}) [${p.gender}]\n`;
          }
        }

        report += "\n";
      }

      setReportData(report);
    } else {
      const { data: rooms } = await supabase
        .from("rooms")
        .select("*")
        .eq("trip_id", selectedTrip);

      let report = `=== ${t("admin.roomReport")} ===\n`;
      report += `${lang === "ar" ? trip.title_ar : trip.title_en} — ${trip.trip_date}\n\n`;

      for (const room of rooms || []) {
        report += `--- ${room.room_label} (${room.room_type}) ---\n`;
        report += `${t("admin.supervisorName")}: ${room.supervisor_name || "-"}\n`;
        report += `${t("admin.capacity")}: ${room.capacity}\n`;

        const { data: bookings } = await supabase
          .from("bookings")
          .select("user_id")
          .eq("room_id", room.id)
          .is("cancelled_at", null);

        const userIds = (bookings || []).map((b) => b.user_id);
        report += `${t("admin.occupants")} (${userIds.length}):\n`;

        if (userIds.length > 0) {
          const { data: occupants } = await supabase
            .from("profiles")
            .select("full_name, phone, gender")
            .in("id", userIds);

          for (const o of occupants || []) {
            report += `  - ${o.full_name} (${o.phone}) [${o.gender}]\n`;
          }
        }

        report += "\n";
      }

      setReportData(report);
    }

    setGenerating(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-xl text-gray-500">{t("common.loading")}</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t("admin.reports")}</h1>

      <div className="card mb-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="label-text">{t("admin.selectTrip")}</label>
            <select
              className="input-field"
              value={selectedTrip}
              onChange={(e) => {
                setSelectedTrip(e.target.value);
                setReportData("");
              }}
            >
              <option value="">---</option>
              {trips.map((trip) => (
                <option key={trip.id} value={trip.id}>
                  {lang === "ar" ? trip.title_ar : trip.title_en}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={() => generateReport("bus")}
              disabled={generating}
              className="btn-primary"
            >
              {generating ? t("common.loading") : t("admin.busReport")}
            </button>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => generateReport("room")}
              disabled={generating}
              className="btn-primary"
            >
              {generating ? t("common.loading") : t("admin.roomReport")}
            </button>
          </div>
        </div>
      </div>

      {reportData && (
        <div className="card">
          <pre
            className="whitespace-pre-wrap text-sm leading-relaxed font-mono"
            dir="rtl"
          >
            {reportData}
          </pre>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add reports page with bus and room report generation"
```
