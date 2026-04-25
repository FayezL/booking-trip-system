"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useToast } from "@/components/Toast";
import LoadingSpinner from "@/components/LoadingSpinner";
import { logAction } from "@/lib/admin-logs";
import type { Bus } from "@/lib/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Bus as BusIcon, Users, ArrowLeftRight, Trash2, Plus, Pencil, ChevronDown, ChevronUp } from "lucide-react";

type Passenger = {
  booking_id: string;
  user_id: string;
  full_name: string;
  gender: string;
  has_wheelchair: boolean;
  sector_name: string;
  family_member_id: string | null;
};

type BusWithPassengers = Bus & { passengers: Passenger[] };

type BusForm = {
  area_name: string;
  capacity: number;
  leader_name: string;
  bus_label: string;
  bus_count: number;
};

const emptyForm: BusForm = {
  area_name: "",
  capacity: 0,
  leader_name: "",
  bus_label: "",
  bus_count: 1,
};

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export default function BusesTab({ tripId }: { tripId: string }) {
  const { t } = useTranslation();
  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useToast();

  const [buses, setBuses] = useState<BusWithPassengers[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BusForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [expandedBusIds, setExpandedBusIds] = useState<Set<string>>(new Set());
  const [movingPassenger, setMovingPassenger] = useState<string | null>(null);
  const [selectedTargetBus, setSelectedTargetBus] = useState<string>("");
  const [removingPassenger, setRemovingPassenger] = useState<string | null>(null);
  const [unassigned, setUnassigned] = useState<Passenger[]>([]);

  const loadBuses = useCallback(async () => {
    try {
      const [busesRes, bookingsRes] = await Promise.all([
        supabase.from("buses").select("*").eq("trip_id", tripId),
        supabase
          .from("bookings")
          .select("id, bus_id, car_id, user_id, family_member_id, profiles(full_name, gender, has_wheelchair, sector_id), family_members(full_name, gender, has_wheelchair)")
          .eq("trip_id", tripId)
          .is("cancelled_at", null),
      ]);

      const sectorIds = new Set<string>();
      for (const b of bookingsRes.data || []) {
        const prof = b.profiles as unknown as { sector_id: string | null };
        if (prof?.sector_id) sectorIds.add(prof.sector_id);
      }

      const sectorMap: Record<string, string> = {};
      if (sectorIds.size > 0) {
        const { data: sectorData } = await supabase
          .from("sectors")
          .select("id, name")
          .in("id", Array.from(sectorIds));
        for (const s of sectorData || []) {
          sectorMap[(s as { id: string; name: string }).id] = (s as { id: string; name: string }).name;
        }
      }

      const passengersByBus: Record<string, Passenger[]> = {};
      for (const b of bookingsRes.data || []) {
        const list = passengersByBus[b.bus_id] || [];
        const p = b.profiles as unknown as { full_name: string; gender: string; has_wheelchair: boolean; sector_id: string | null };
        const fm = (b as { family_members?: { full_name: string; gender: string; has_wheelchair: boolean } | null }).family_members;
        const fmId = (b as { family_member_id?: string | null }).family_member_id || null;
        list.push({
          booking_id: b.id,
          user_id: b.user_id,
          full_name: fmId && fm ? fm.full_name : p.full_name,
          gender: fmId && fm ? fm.gender : p.gender,
          has_wheelchair: fmId && fm ? fm.has_wheelchair : p.has_wheelchair,
          sector_name: p.sector_id ? (sectorMap[p.sector_id] || "") : "",
          family_member_id: fmId,
        });
        passengersByBus[b.bus_id] = list;
      }

      const busesWithPassengers = (busesRes.data || []).map((bus: Bus) => ({
        ...bus,
        passengers: passengersByBus[bus.id] || [],
      }));

      setBuses(busesWithPassengers);

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
    } catch {
      showToast(t("common.error"), "error");
    } finally {
      setLoading(false);
    }
  }, [tripId, supabase, showToast, t]);

  useEffect(() => {
    loadBuses();
  }, [loadBuses]);

  function toggleExpand(busId: string) {
    setExpandedBusIds((prev) => {
      const next = new Set(prev);
      if (next.has(busId)) next.delete(busId);
      else next.add(busId);
      return next;
    });
  }

  function startMove(bookingId: string) {
    setMovingPassenger(bookingId);
    setSelectedTargetBus("");
  }

  async function confirmMove() {
    if (!movingPassenger || !selectedTargetBus) return;

    const { error } = await supabase.rpc("move_passenger_bus", {
      p_booking_id: movingPassenger,
      p_new_bus_id: selectedTargetBus,
    });

    if (error) {
      showToast(t("common.error"), "error");
    } else {
      showToast(t("admin.passengerMoved"), "success");
      logAction("move_passenger", "booking", movingPassenger, { to_bus: selectedTargetBus });
      setMovingPassenger(null);
      setSelectedTargetBus("");
      loadBuses();
    }
  }

  async function confirmRemove(bookingId: string) {
    setRemovingPassenger(bookingId);
    const { error } = await supabase.rpc("cancel_booking", {
      p_booking_id: bookingId,
    });
    setRemovingPassenger(null);

    if (error) {
      showToast(t("common.error"), "error");
    } else {
      showToast(t("admin.passengerRemoved"), "success");
      logAction("remove_passenger", "booking", bookingId);
      loadBuses();
    }
  }

  function handleRemovePassenger(bookingId: string, passengerName: string) {
    if (!confirm(`${t("admin.confirmRemoveFromBus")}\n\n${passengerName}`)) return;
    confirmRemove(bookingId);
  }

  function startEdit(bus: Bus) {
    setEditingId(bus.id);
    setForm({
      area_name: bus.area_name_ar,
      capacity: bus.capacity,
      leader_name: bus.leader_name || "",
      bus_label: bus.bus_label || "",
      bus_count: 1,
    });
    setShowForm(true);
  }

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  async function handleSave() {
    if (editingId) {
      if (!form.bus_label || form.capacity <= 0) {
        showToast(t("common.error"), "error");
        return;
      }

      setSaving(true);
      const { error } = await supabase
        .from("buses")
        .update({
          bus_label: form.bus_label,
          capacity: form.capacity,
          leader_name: form.leader_name || null,
        })
        .eq("id", editingId);
      if (error) showToast(t("common.error"), "error");
      else {
        showToast(t("admin.editBus"), "success");
        logAction("edit_bus", "bus", editingId);
      }
      setSaving(false);
      setShowForm(false);
      loadBuses();
      return;
    }

    if (!form.area_name || form.capacity <= 0 || form.bus_count < 1) {
      showToast(t("common.error"), "error");
      return;
    }

    setSaving(true);

    const existingLabels = buses.map((b) => b.bus_label || "");

    const busesToCreate = [];
    let labelIndex = 1;

    for (let i = 0; i < form.bus_count; i++) {
      let label = `${form.area_name} Bus ${labelIndex}`;
      while (existingLabels.includes(label)) {
        labelIndex++;
        label = `${form.area_name} Bus ${labelIndex}`;
      }
      existingLabels.push(label);
      busesToCreate.push({
        trip_id: tripId,
        area_name_ar: form.area_name,
        area_name_en: form.area_name,
        capacity: form.capacity,
        leader_name: form.leader_name || null,
        bus_label: label,
      });
      labelIndex++;
    }

    const { error } = await supabase.from("buses").insert(busesToCreate);

    if (error) showToast(t("common.error"), "error");
    else {
      showToast(t("admin.createBus"), "success");
      logAction("bulk_create_buses", "bus", undefined, { count: form.bus_count });
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
      logAction("delete_bus", "bus", id);
      loadBuses();
    }
  }

  if (loading) {
    return <LoadingSpinner text={t("common.loading")} />;
  }

  function getCapacityVariant(percent: number): "default" | "secondary" | "destructive" {
    if (percent >= 100) return "destructive";
    if (percent >= 80) return "secondary";
    return "default";
  }

  function getFillClass(percent: number) {
    if (percent >= 100) return "bg-red-500";
    if (percent >= 80) return "bg-amber-500";
    return "bg-blue-500";
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BusIcon className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{t("admin.buses")}</h2>
        </div>
        <Button onClick={startCreate} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          {t("admin.createBus")}
        </Button>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingId ? t("common.edit") : t("admin.createBus")}</DialogTitle>
            <DialogDescription>
              {editingId ? t("admin.busLabel") : t("admin.areaName")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            {editingId ? (
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1.5 block">{t("admin.busLabel")}</label>
                <input
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={form.bus_label}
                  onChange={(e) => setForm({ ...form, bus_label: e.target.value })}
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">{t("admin.areaName")}</label>
                  <input
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={form.area_name}
                    onChange={(e) => setForm({ ...form, area_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">{t("admin.numberOfBuses")}</label>
                  <input
                    type="number"
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={form.bus_count || ""}
                    onChange={(e) => setForm({ ...form, bus_count: parseInt(e.target.value) || 1 })}
                    dir="ltr"
                    min="1"
                    max="20"
                  />
                </div>
              </>
            )}
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
              <label className="text-sm font-medium text-muted-foreground mb-1.5 block">{t("admin.leaderName")}</label>
              <input
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={form.leader_name}
                onChange={(e) => setForm({ ...form, leader_name: e.target.value })}
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

      <Dialog open={!!movingPassenger} onOpenChange={(open) => { if (!open) setMovingPassenger(null); }}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{t("admin.moveToBus")}</DialogTitle>
            <DialogDescription>{t("admin.selectBus")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {(() => {
              const currentBus = buses.find((b) =>
                b.passengers.some((p) => p.booking_id === movingPassenger)
              );
              const otherBuses = currentBus
                ? buses.filter((b) => b.id !== currentBus.id)
                : buses;
              return (
                <div className="space-y-2">
                  {otherBuses.map((ob) => {
                    const obCount = ob.passengers.length;
                    const obPercent = ob.capacity > 0 ? (obCount / ob.capacity) * 100 : 0;
                    return (
                      <button
                        key={ob.id}
                        onClick={() => setSelectedTargetBus(ob.id)}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-right",
                          selectedTargetBus === ob.id
                            ? "border-primary bg-primary/5"
                            : "border-transparent bg-muted/50 hover:bg-muted"
                        )}
                      >
                        <BusIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{ob.bus_label || ob.area_name_ar}</div>
                          <div className="text-xs text-muted-foreground">{obCount}/{ob.capacity}</div>
                        </div>
                        <Badge variant={getCapacityVariant(obPercent)}>{obCount}/{ob.capacity}</Badge>
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button onClick={confirmMove} disabled={!selectedTargetBus} className="gap-2">
              <ArrowLeftRight className="h-4 w-4" />
              {t("admin.book")}
            </Button>
            <Button variant="outline" onClick={() => setMovingPassenger(null)}>
              {t("admin.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {unassigned.length > 0 && (
        <Card className="border-amber-300 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/10">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <CardTitle className="text-base">{t("admin.unassignedPassengers")}</CardTitle>
              <Badge variant="secondary">{unassigned.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2">
              {unassigned.map((p) => (
                <div key={p.booking_id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-background/80">
                  <div className="flex items-center gap-2.5">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className={cn("text-xs", p.gender === "Male" ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300" : "bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300")}>
                        {getInitials(p.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-medium">{p.full_name}</span>
                      <Badge variant="outline" className={cn("text-[10px] px-1.5", p.gender === "Male" ? "border-blue-300 text-blue-600 dark:text-blue-400" : "border-pink-300 text-pink-600 dark:text-pink-400")}>
                        {p.gender === "Male" ? "♂" : "♀"}
                      </Badge>
                      {p.has_wheelchair && (
                        <Badge variant="outline" className="text-[10px] px-1.5 border-amber-300 text-amber-600 dark:text-amber-400">♿</Badge>
                      )}
                      {p.sector_name && (
                        <Badge variant="outline" className="text-[10px] px-1.5 border-teal-300 text-teal-600 dark:text-teal-400">{p.sector_name}</Badge>
                      )}
                      {p.family_member_id && (
                        <Badge variant="outline" className="text-[10px] px-1.5 border-violet-300 text-violet-600 dark:text-violet-400">↳</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {buses.length > 0 && (
                      <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => startMove(p.booking_id)}>
                        <ArrowLeftRight className="h-3 w-3" />
                        {t("admin.moveToBus")}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1 text-red-600 hover:text-red-700 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => handleRemovePassenger(p.booking_id, p.full_name)}>
                      <Trash2 className="h-3 w-3" />
                      {t("admin.cancelBooking")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {buses.length === 0 ? (
        <div className="text-center py-12">
          <BusIcon className="h-14 w-14 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-lg text-muted-foreground mb-1">{t("admin.noBusesYet")}</p>
          <p className="text-sm text-muted-foreground/60 mb-4">{t("admin.addBusesFirst")}</p>
          <Button onClick={startCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            {t("admin.createBus")}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {buses.map((bus) => {
            const count = bus.passengers.length;
            const percent = bus.capacity > 0 ? (count / bus.capacity) * 100 : 0;
            const displayName = bus.bus_label || bus.area_name_ar;
            const isExpanded = expandedBusIds.has(bus.id);

            return (
              <Card key={bus.id}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                        <BusIcon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold">{displayName}</h3>
                        {bus.leader_name && (
                          <p className="text-xs text-muted-foreground">{t("admin.leaderName")}: {bus.leader_name}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={getCapacityVariant(percent)} className="text-xs">
                        {count}/{bus.capacity}
                      </Badge>
                      <Button size="sm" variant="ghost" className="h-8 text-xs gap-1" onClick={() => toggleExpand(bus.id)}>
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        {isExpanded ? t("admin.hidePassengers") : t("admin.showPassengers")}
                        {count > 0 && <span className="ms-1">({count})</span>}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 text-xs gap-1" onClick={() => startEdit(bus)}>
                        <Pencil className="h-3.5 w-3.5" />
                        {t("common.edit")}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 text-xs gap-1 text-red-600 hover:text-red-700 dark:text-red-400" onClick={() => handleDelete(bus.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                        {t("common.delete")}
                      </Button>
                    </div>
                  </div>

                  <div className="flex justify-between text-sm text-muted-foreground mb-1.5">
                    <span>{t("admin.passengers")}: {count}/{bus.capacity}</span>
                    <span>{Math.round(percent)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all duration-500", getFillClass(percent))}
                      style={{ width: `${Math.min(percent, 100)}%` }}
                    />
                  </div>

                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t">
                      {count === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-2">{t("admin.noPassengers")}</p>
                      ) : (
                        <div className="space-y-2">
                          {bus.passengers.map((p) => (
                            <div
                              key={p.booking_id}
                              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-muted/50"
                            >
                              <div className="flex items-center gap-2.5">
                                <Avatar className="h-7 w-7">
                                  <AvatarFallback className={cn("text-[10px]", p.gender === "Male" ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300" : "bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300")}>
                                    {getInitials(p.full_name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {p.family_member_id && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 border-violet-300 text-violet-600 dark:text-violet-400">↳</Badge>
                                  )}
                                  <span className="text-sm font-medium">{p.full_name}</span>
                                  <Badge variant="outline" className={cn("text-[10px] px-1.5", p.gender === "Male" ? "border-blue-300 text-blue-600 dark:text-blue-400" : "border-pink-300 text-pink-600 dark:text-pink-400")}>
                                    {p.gender === "Male" ? "♂" : "♀"}
                                  </Badge>
                                  {p.has_wheelchair && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 border-amber-300 text-amber-600 dark:text-amber-400">♿</Badge>
                                  )}
                                  {p.sector_name && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 border-teal-300 text-teal-600 dark:text-teal-400">{p.sector_name}</Badge>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                {removingPassenger === p.booking_id ? (
                                  <span className="text-xs text-muted-foreground">{t("common.loading")}</span>
                                ) : (
                                  <>
                                    {buses.filter((b) => b.id !== bus.id).length > 0 && (
                                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => startMove(p.booking_id)}>
                                        <ArrowLeftRight className="h-3 w-3" />
                                        {t("admin.moveToBus")}
                                      </Button>
                                    )}
                                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-red-600 hover:text-red-700 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => handleRemovePassenger(p.booking_id, p.full_name)}>
                                      <Trash2 className="h-3 w-3" />
                                      {t("admin.removeFromBus")}
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
