"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useToast } from "@/components/Toast";
import LoadingSpinner from "@/components/LoadingSpinner";
import { logAction } from "@/lib/admin-logs";
import type { Room, Booking, Profile } from "@/lib/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Bed, Users, Plus, Trash2, Search } from "lucide-react";

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

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

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

  const loadData = useCallback(async () => {
    try {
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
    } catch {
      showToast(t("common.error"), "error");
    } finally {
      setLoading(false);
    }
  }, [tripId, supabase, showToast, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

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

  const allGenderCount = unassigned.filter((b) => b.profiles.gender === genderTab).length;

  function getFillClass(percent: number) {
    if (percent >= 100) return "bg-red-500";
    if (percent >= 80) return "bg-amber-500";
    return "bg-blue-500";
  }

  function getCapacityVariant(percent: number): "default" | "secondary" | "destructive" {
    if (percent >= 100) return "destructive";
    if (percent >= 80) return "secondary";
    return "default";
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bed className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{t("admin.rooms")}</h2>
        </div>
        <Button onClick={startCreate} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          {t("admin.createRoom")}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-muted p-1 rounded-lg">
          <Button size="sm" variant={genderTab === "Male" ? "default" : "ghost"} className="h-8 text-xs" onClick={() => setGenderTab("Male")}>
            {t("admin.boysTab")}
          </Button>
          <Button size="sm" variant={genderTab === "Female" ? "default" : "ghost"} className="h-8 text-xs" onClick={() => setGenderTab("Female")}>
            {t("admin.girlsTab")}
          </Button>
        </div>

        <div className="flex gap-1">
          {(["all", "available", "full"] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={roomFilter === f ? "secondary" : "ghost"}
              className="h-8 text-xs"
              onClick={() => setRoomFilter(f)}
            >
              {f === "all" ? t("admin.all") : f === "available" ? t("admin.areaActive") : t("buses.full").split("—")[0].trim()}
            </Button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[140px] max-w-xs">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            className="flex h-9 w-full rounded-lg border border-input bg-background pr-9 pl-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder={t("admin.searchByName")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingId ? t("common.edit") : t("admin.createRoom")}</DialogTitle>
            <DialogDescription>{t("admin.roomLabel")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1.5 block">{t("admin.roomLabel")}</label>
              <input
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={form.room_label}
                onChange={(e) => setForm({ ...form, room_label: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1.5 block">{t("admin.capacity")}</label>
              <input
                type="number"
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={form.capacity || ""}
                onChange={(e) => setForm({ ...form, capacity: parseInt(e.target.value) || 0 })}
                dir="ltr"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1.5 block">{t("admin.supervisorName")}</label>
              <input
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={form.supervisor_name}
                onChange={(e) => setForm({ ...form, supervisor_name: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? t("common.loading") : t("admin.save")}
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              {t("admin.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-base font-semibold">
              {t("admin.unassigned")} ({filteredUnassigned.length}/{allGenderCount})
            </h3>
          </div>
          <div className="space-y-2">
            {filteredUnassigned.length === 0 ? (
              <p className="text-muted-foreground text-center py-4 text-sm">{t("admin.noUnassigned")}</p>
            ) : (
              filteredUnassigned.map((b) => (
                <Card
                  key={b.id}
                  className={cn(
                    "cursor-pointer transition-all hover:shadow-sm",
                    selectedBooking === b.id && "ring-2 ring-primary shadow-sm"
                  )}
                  onClick={() => setSelectedBooking(b.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className={cn("text-xs", b.profiles.gender === "Male" ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300" : "bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300")}>
                            {getInitials(b.profiles.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-sm">{b.profiles.full_name}</span>
                        {b.profiles.has_wheelchair && (
                          <Badge variant="outline" className="text-[10px] px-1.5 border-amber-300 text-amber-600 dark:text-amber-400">♿</Badge>
                        )}
                      </div>
                      <Badge variant="outline" className={cn("text-[10px]", b.profiles.gender === "Male" ? "border-blue-300 text-blue-600 dark:text-blue-400" : "border-pink-300 text-pink-600 dark:text-pink-400")}>
                        {b.profiles.gender === "Male" ? t("auth.male") : t("auth.female")}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Bed className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-base font-semibold">
              {genderTab === "Male" ? t("admin.boysTab") : t("admin.girlsTab")} — {t("admin.rooms")} ({filteredRooms.length})
            </h3>
          </div>
          <div className="space-y-3">
            {filteredRooms.map((room) => {
              const canAssign = selectedBooking && room.occupant_count < room.capacity;
              const percent = room.capacity > 0 ? (room.occupant_count / room.capacity) * 100 : 0;

              return (
                <Card key={room.id}>
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{room.room_label}</span>
                        <Badge variant={getCapacityVariant(percent)} className="text-xs">
                          {room.occupant_count}/{room.capacity}
                        </Badge>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => startEdit(room)}>
                          {t("common.edit")}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-red-600 hover:text-red-700 dark:text-red-400" onClick={() => handleDelete(room.id)}>
                          <Trash2 className="h-3 w-3" />
                          {t("common.delete")}
                        </Button>
                      </div>
                    </div>

                    <div className="text-sm text-muted-foreground mb-2">
                      {room.occupant_count}/{room.capacity} {t("admin.occupants")}
                      {room.supervisor_name && ` — ${room.supervisor_name}`}
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-2">
                      <div
                        className={cn("h-full rounded-full transition-all duration-500", getFillClass(percent))}
                        style={{ width: `${Math.min(percent, 100)}%` }}
                      />
                    </div>

                    {room.occupants.length > 0 && (
                      <div className="space-y-1.5">
                        {room.occupants.map((o) => (
                          <div key={o.id} className="flex items-center justify-between text-sm p-1.5 rounded-md bg-muted/50">
                            <span className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-[9px]">{getInitials(o.full_name)}</AvatarFallback>
                              </Avatar>
                              <span className="text-muted-foreground">{o.full_name}</span>
                              {o.has_wheelchair && (
                                <Badge variant="outline" className="text-[10px] px-1 border-amber-300 text-amber-600 dark:text-amber-400">♿</Badge>
                              )}
                            </span>
                            <Button size="sm" variant="ghost" className="h-6 text-xs text-red-500 hover:text-red-600 dark:text-red-400 px-2" onClick={() => handleRemoveFromRoom(o.booking_id)}>
                              {t("admin.removeFromRoom")}
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {canAssign && (
                      <Button
                        onClick={() => handleAssign(selectedBooking, room.id)}
                        className="mt-3 w-full text-sm"
                        size="sm"
                      >
                        {t("admin.assignRoom")}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
