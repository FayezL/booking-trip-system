"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useToast } from "@/components/Toast";
import LoadingSpinner from "@/components/LoadingSpinner";
import { logAction } from "@/lib/admin-logs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Progress,
  ProgressIndicator,
  ProgressLabel,
  ProgressTrack,
  ProgressValue,
} from "@/components/ui/progress";
import { Plus, Pencil, Trash2, BedDouble, User, Search, Check, X } from "lucide-react";
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
  const [deleteRoomId, setDeleteRoomId] = useState<string | null>(null);

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

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">{t("admin.rooms")}</h2>
        <Button onClick={startCreate}>
          <Plus /> {t("admin.createRoom")}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Tabs value={genderTab} onValueChange={(v) => setGenderTab(v as "Male" | "Female")}>
          <TabsList>
            <TabsTrigger value="Male">{t("admin.boysTab")}</TabsTrigger>
            <TabsTrigger value="Female">{t("admin.girlsTab")}</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex gap-1">
          <Button
            variant={roomFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setRoomFilter("all")}
          >
            {t("admin.all")}
          </Button>
          <Button
            variant={roomFilter === "available" ? "default" : "outline"}
            size="sm"
            onClick={() => setRoomFilter("available")}
          >
            {t("admin.areaActive")}
          </Button>
          <Button
            variant={roomFilter === "full" ? "default" : "outline"}
            size="sm"
            onClick={() => setRoomFilter("full")}
          >
            {t("buses.full").split("—")[0].trim()}
          </Button>
        </div>

        <div className="relative flex-1 min-w-[140px] max-w-xs">
          <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder={t("admin.searchByName")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="ps-8"
          />
        </div>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? t("common.edit") : t("admin.createRoom")}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
            <div>
              <Label className="mb-1.5">{t("admin.roomLabel")}</Label>
              <Input
                value={form.room_label}
                onChange={(e) => setForm({ ...form, room_label: e.target.value })}
              />
            </div>
            <div>
              <Label className="mb-1.5">{t("admin.capacity")}</Label>
              <Input
                type="number"
                value={form.capacity || ""}
                onChange={(e) => setForm({ ...form, capacity: parseInt(e.target.value) || 0 })}
                dir="ltr"
              />
            </div>
            <div>
              <Label className="mb-1.5">{t("admin.supervisorName")}</Label>
              <Input
                value={form.supervisor_name}
                onChange={(e) => setForm({ ...form, supervisor_name: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? t("common.loading") : t("admin.save")}
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              {t("admin.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteRoomId}
        onOpenChange={(open) => {
          if (!open) setDeleteRoomId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("admin.confirmDelete")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (deleteRoomId) handleDelete(deleteRoomId);
              }}
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
        <div>
          <h3 className="text-base font-bold mb-3">
            {t("admin.unassigned")} ({filteredUnassigned.length}/{allGenderCount})
          </h3>
          <div className="space-y-2">
            {filteredUnassigned.length === 0 ? (
              <p className="text-muted-foreground text-center py-4 text-sm">{t("admin.noUnassigned")}</p>
            ) : (
              filteredUnassigned.map((b) => (
                <div
                  key={b.id}
                  onClick={() => setSelectedBooking(b.id)}
                  className={`cursor-pointer transition-all duration-150 rounded-xl p-4 bg-card text-card-foreground shadow-xs ring-1 ring-foreground/10 ${
                    selectedBooking === b.id
                      ? "ring-2 ring-primary shadow-sm"
                      : "hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 font-medium text-sm">
                      <User className="size-4 text-muted-foreground" />
                      {b.profiles.full_name}
                      {b.profiles.has_wheelchair && <span title={t("admin.wheelchair")}>♿</span>}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {b.profiles.gender === "Male" ? t("auth.male") : t("auth.female")}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <h3 className="text-base font-bold mb-3">
            {genderTab === "Male" ? t("admin.boysTab") : t("admin.girlsTab")} — {t("admin.rooms")} ({filteredRooms.length})
          </h3>
          <div className="space-y-3">
            {filteredRooms.map((room) => {
              const canAssign =
                selectedBooking &&
                room.occupant_count < room.capacity;

              const percent = room.capacity > 0 ? (room.occupant_count / room.capacity) * 100 : 0;
              const progressClassName =
                percent >= 100
                  ? "[&_[data-slot=progress-indicator]]:bg-destructive"
                  : percent > 80
                    ? "[&_[data-slot=progress-indicator]]:bg-amber-500"
                    : "";

              return (
                <Card key={room.id}>
                  <CardContent>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <BedDouble className="size-4 text-muted-foreground" />
                        <span className="font-bold">{room.room_label}</span>
                        <Badge variant="secondary">
                          {room.occupant_count}/{room.capacity}
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => startEdit(room)}
                        >
                          <Pencil /> {t("common.edit")}
                        </Button>
                        <Button
                          variant="destructive"
                          size="xs"
                          onClick={() => setDeleteRoomId(room.id)}
                        >
                          <Trash2 /> {t("common.delete")}
                        </Button>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground mb-2">
                      {room.occupant_count}/{room.capacity} {t("admin.occupants")}
                      {room.supervisor_name && ` — ${room.supervisor_name}`}
                    </div>
                    <Progress value={Math.min(percent, 100)} className={`mb-2 ${progressClassName}`} />
                    {room.occupants.length > 0 && (
                      <div className="space-y-1">
                        {room.occupants.map((o) => (
                          <div key={o.id} className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-1 text-muted-foreground">
                              {o.full_name}
                              {o.has_wheelchair && <span title={t("admin.wheelchair")}>♿</span>}
                            </span>
                            <Button
                              variant="ghost"
                              size="xs"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleRemoveFromRoom(o.booking_id)}
                            >
                              <X /> {t("admin.removeFromRoom")}
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    {canAssign && (
                      <Button
                        onClick={() => handleAssign(selectedBooking, room.id)}
                        className="mt-3 w-full"
                        size="sm"
                      >
                        <Check /> {t("admin.assignRoom")}
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
