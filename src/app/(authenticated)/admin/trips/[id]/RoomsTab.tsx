"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useToast } from "@/components/Toast";
import LoadingSpinner from "@/components/LoadingSpinner";
import { logAction } from "@/lib/admin-logs";
import type { Room, Booking, Profile } from "@/lib/types/database";

type RoomForm = {
  room_label: string;
  capacity: number;
  supervisor_name: string;
};

const emptyForm: RoomForm = {
  room_label: "",
  capacity: 0,
  supervisor_name: "",
};

type BookingWithProfile = Booking & { profiles: Profile };
type RoomWithOccupants = Room & { occupant_count: number; occupants: { id: string; full_name: string; has_wheelchair: boolean; booking_id: string }[] };

export default function RoomsTab({ tripId }: { tripId: string }) {
  const { t } = useTranslation();
  const supabase = createClient();
  const { showToast } = useToast();

  const [rooms, setRooms] = useState<RoomWithOccupants[]>([]);
  const [unassigned, setUnassigned] = useState<BookingWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RoomForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<string | null>(null);
  const [genderTab, setGenderTab] = useState<"Male" | "Female">("Male");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [roomFilter, setRoomFilter] = useState<"all" | "available" | "full">("all");

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  async function loadData() {
    const [roomsRes, bookingsRes] = await Promise.all([
      supabase.from("rooms").select("*").eq("trip_id", tripId),
      supabase
        .from("bookings")
        .select("*, profiles(*)")
        .eq("trip_id", tripId)
        .is("cancelled_at", null),
    ]);

    const allBookings = bookingsRes.data || [];

    const bookingsByRoom = new Map<string, typeof allBookings>();
    for (const b of allBookings) {
      if (!b.room_id) continue;
      const list = bookingsByRoom.get(b.room_id) || ([] as typeof allBookings);
      list.push(b);
      bookingsByRoom.set(b.room_id, list);
    }

    const roomsWithOccupants: RoomWithOccupants[] = (roomsRes.data || []).map((room: Room) => {
      const roomBookings = bookingsByRoom.get(room.id) || ([] as typeof allBookings);
      return {
        ...room,
        occupant_count: roomBookings.length,
        occupants: roomBookings.map((b: { id: string; profiles: unknown }) => ({
          id: (b.profiles as unknown as Profile).id,
          full_name: (b.profiles as unknown as Profile).full_name,
          has_wheelchair: (b.profiles as unknown as Profile).has_wheelchair,
          booking_id: b.id,
        })),
      };
    });

    const unassignedBookings = allBookings.filter((b: { room_id: string | null }) => b.room_id === null);

    setRooms(roomsWithOccupants);
    setUnassigned(unassignedBookings as unknown as BookingWithProfile[]);
    setLoading(false);
  }

  const filteredUnassigned = useMemo(() => {
    return unassigned.filter((b) => {
      if (b.profiles.gender !== genderTab) return false;
      if (search && !b.profiles.full_name.includes(search)) return false;
      return true;
    });
  }, [unassigned, genderTab, search]);

  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      if (r.room_type !== genderTab) return false;
      if (roomFilter === "available" && r.occupant_count >= r.capacity) return false;
      if (roomFilter === "full" && r.occupant_count < r.capacity) return false;
      if (search) {
        const hasMatch = r.room_label.includes(search) ||
          r.occupants.some((o) => o.full_name.includes(search));
        if (!hasMatch) return false;
      }
      return true;
    });
  }, [rooms, genderTab, roomFilter, search]);

  function startEdit(room: Room) {
    setEditingId(room.id);
    setForm({
      room_label: room.room_label,
      capacity: room.capacity,
      supervisor_name: room.supervisor_name || "",
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

    let hadError = false;

    if (editingId) {
      const { error } = await supabase
        .from("rooms")
        .update(form)
        .eq("id", editingId);
      if (error) { showToast(t("common.error"), "error"); hadError = true; }
      else {
        showToast(t("admin.editRoom"), "success");
        logAction("edit_room", "room", editingId);
      }
    } else {
      const { error } = await supabase
        .from("rooms")
        .insert({ ...form, room_type: genderTab, trip_id: tripId });
      if (error) { showToast(t("common.error"), "error"); hadError = true; }
      else {
        showToast(t("admin.createRoom"), "success");
        logAction("create_room", "room");
      }
    }

    setSaving(false);
    if (hadError) return;
    setShowForm(false);
    loadData();
  }

  async function handleDelete(id: string) {
    if (!confirm(t("admin.confirmDelete"))) return;
    const { error } = await supabase.from("rooms").delete().eq("id", id);
    if (error) showToast(t("common.error"), "error");
    else {
      showToast(t("admin.deleteRoom"), "success");
      logAction("delete_room", "room", id);
      loadData();
    }
  }

  async function handleAssign(bookingId: string, roomId: string) {
    const { error } = await supabase.rpc("assign_room", {
      p_booking_id: bookingId,
      p_room_id: roomId,
    });

    if (error) {
      showToast(t("common.error"), "error");
    } else {
      showToast(t("admin.assignRoom"), "success");
      logAction("assign_room", "booking", bookingId);
      setSelectedBooking(null);
      loadData();
    }
  }

  async function handleRemoveFromRoom(bookingId: string) {
    const { error } = await supabase
      .from("bookings")
      .update({ room_id: null })
      .eq("id", bookingId);
    if (error) showToast(t("common.error"), "error");
    else {
      showToast(t("admin.removeFromRoom"), "success");
      logAction("remove_from_room", "booking", bookingId);
      loadData();
    }
  }

  if (loading) {
    return <LoadingSpinner text={t("common.loading")} />;
  }

  const tabClass = (active: boolean) =>
    `px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-150 ${
      active
        ? "bg-blue-600 text-white shadow-sm"
        : "bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-gray-700"
    }`;

  const filterClass = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
      active
        ? "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400"
        : "bg-slate-50 dark:bg-gray-800 text-slate-500 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700"
    }`;

  const allGenderCount = unassigned.filter((b) => b.profiles.gender === genderTab).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-800 dark:text-gray-100">{t("admin.rooms")}</h2>
        <button onClick={startCreate} className="btn-primary">
          + {t("admin.createRoom")}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex gap-2">
          <button onClick={() => setGenderTab("Male")} className={tabClass(genderTab === "Male")}>
            {t("admin.boysTab")}
          </button>
          <button onClick={() => setGenderTab("Female")} className={tabClass(genderTab === "Female")}>
            {t("admin.girlsTab")}
          </button>
        </div>

        <div className="flex gap-1">
          <button onClick={() => setRoomFilter("all")} className={filterClass(roomFilter === "all")}>
            {t("admin.all")}
          </button>
          <button onClick={() => setRoomFilter("available")} className={filterClass(roomFilter === "available")}>
            {t("admin.areaActive")}
          </button>
          <button onClick={() => setRoomFilter("full")} className={filterClass(roomFilter === "full")}>
            {t("buses.full").split("—")[0].trim()}
          </button>
        </div>

        <input
          className="input-field flex-1 min-w-[140px] max-w-xs"
          placeholder={t("admin.searchByName")}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>

      {showForm && (
        <div className="card mb-4 animate-slide-up">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
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
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <button onClick={handleSave} disabled={saving} className="btn-primary w-full sm:w-auto">
              {saving ? t("common.loading") : t("admin.save")}
            </button>
            <button onClick={() => setShowForm(false)} className="btn-secondary w-full sm:w-auto">
              {t("admin.cancel")}
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
        <div>
          <h3 className="text-base font-bold text-slate-800 dark:text-gray-100 mb-3">
            {t("admin.unassigned")} ({filteredUnassigned.length}/{allGenderCount})
          </h3>
          <div className="space-y-2">
            {filteredUnassigned.length === 0 ? (
              <p className="text-slate-400 dark:text-gray-500 text-center py-4 text-sm">{t("admin.noUnassigned")}</p>
            ) : (
              filteredUnassigned.map((b) => (
                <div
                  key={b.id}
                  onClick={() => setSelectedBooking(b.id)}
                  className={`card cursor-pointer transition-all duration-150 ${
                    selectedBooking === b.id
                      ? "ring-2 ring-blue-500 dark:ring-blue-400 shadow-sm"
                      : "hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 font-medium text-slate-800 dark:text-gray-100 text-sm">
                      {b.profiles.full_name}
                      {b.profiles.has_wheelchair && <span title={t("admin.wheelchair")}>♿</span>}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        b.profiles.gender === "Male"
                          ? "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400"
                          : "bg-pink-50 dark:bg-pink-950/30 text-pink-600 dark:text-pink-400"
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
          <h3 className="text-base font-bold text-slate-800 dark:text-gray-100 mb-3">
            {genderTab === "Male" ? t("admin.boysTab") : t("admin.girlsTab")} — {t("admin.rooms")} ({filteredRooms.length})
          </h3>
          <div className="space-y-3">
            {filteredRooms.map((room) => {
              const canAssign =
                selectedBooking &&
                room.occupant_count < room.capacity;

              const percent = room.capacity > 0 ? (room.occupant_count / room.capacity) * 100 : 0;
              const fillClass = percent >= 100 ? "danger" : percent > 80 ? "warning" : "";

              return (
                <div key={room.id} className="card">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <span className="font-bold text-slate-800 dark:text-gray-100">{room.room_label}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(room)}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-50 dark:bg-gray-800 text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700 active:scale-95 transition-all duration-150"
                      >
                        {t("common.edit")}
                      </button>
                      <button
                        onClick={() => handleDelete(room.id)}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/50 active:scale-95 transition-all duration-150"
                      >
                        {t("common.delete")}
                      </button>
                    </div>
                  </div>
                  <div className="text-sm text-slate-400 dark:text-gray-500 mb-2">
                    {room.occupant_count}/{room.capacity} {t("admin.occupants")}
                    {room.supervisor_name && ` — ${room.supervisor_name}`}
                  </div>
                  <div className="progress-bar mb-2">
                    <div
                      className={`progress-bar-fill ${fillClass}`}
                      style={{ width: `${Math.min(percent, 100)}%` }}
                    />
                  </div>
                  {room.occupants.length > 0 && (
                    <div className="space-y-1">
                      {room.occupants.map((o) => (
                        <div key={o.id} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1 text-slate-500 dark:text-gray-400">
                            {o.full_name}
                            {o.has_wheelchair && <span title={t("admin.wheelchair")}>♿</span>}
                          </span>
                          <button
                            onClick={() => handleRemoveFromRoom(o.booking_id)}
                            className="text-xs text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors"
                          >
                            {t("admin.removeFromRoom")}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {canAssign && (
                    <button
                      onClick={() => handleAssign(selectedBooking, room.id)}
                      className="btn-primary mt-3 w-full text-sm py-2"
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
