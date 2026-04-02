"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useToast } from "@/components/Toast";
import LoadingSpinner from "@/components/LoadingSpinner";
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
type RoomWithCount = Room & { occupant_count: number; occupants: Profile[] };

export default function RoomsTab({ tripId }: { tripId: string }) {
  const { t } = useTranslation();
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

    const roomsWithCounts: RoomWithCount[] = (roomsRes.data || []).map((room: Room) => {
      const roomBookings = bookingsByRoom.get(room.id) || ([] as typeof allBookings);
      return {
        ...room,
        occupant_count: roomBookings.length,
        occupants: roomBookings.map((b: { profiles: unknown }) => b.profiles as unknown as Profile),
      };
    });

    const unassignedBookings = allBookings.filter((b: { room_id: string | null }) => b.room_id === null);

    setRooms(roomsWithCounts);
    setUnassigned(unassignedBookings as unknown as BookingWithProfile[]);
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
      if (error.message.includes("Gender mismatch")) {
        showToast(t("common.error"), "error");
      } else if (error.message.includes("full") || error.message.includes("Room is full")) {
        showToast(t("common.error"), "error");
      } else {
        showToast(t("common.error"), "error");
      }
    } else {
      showToast(t("admin.assignRoom"), "success");
      setSelectedBooking(null);
      loadData();
    }
  }

  if (loading) {
    return <LoadingSpinner text={t("common.loading")} />;
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
                        {t("common.edit")}
                      </button>
                      <button
                        onClick={() => handleDelete(room.id)}
                        className="px-2 py-1 rounded text-xs bg-red-100 text-red-700"
                      >
                        {t("common.delete")}
                      </button>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {room.occupant_count}/{room.capacity} {t("admin.occupants")}
                    {room.supervisor_name && ` — ${room.supervisor_name}`}
                  </div>
                  {room.occupants.length > 0 && (
                    <div className="mt-2 text-sm text-gray-600">
                      {room.occupants.map((o) => o.full_name).join("، ")}
                    </div>
                  )}
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
