"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { toast } from "sonner";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Progress,
} from "@/components/ui/progress";
import { Plus, Pencil, Trash2, ChevronDown, UserMinus, ArrowRightLeft, User, Bus as BusIcon } from "lucide-react";
import type { Bus } from "@/lib/types/database";

type Passenger = {
  booking_id: string;
  user_id: string;
  full_name: string;
  gender: string;
  has_wheelchair: boolean;
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

export default function BusesTab({ tripId }: { tripId: string }) {
  const { t } = useTranslation();
  const supabase = createClient();

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
  const [deleteBusId, setDeleteBusId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    loadBuses();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  async function loadBuses() {
    const [busesRes, bookingsRes] = await Promise.all([
      supabase.from("buses").select("*").eq("trip_id", tripId),
      supabase
        .from("bookings")
        .select("id, bus_id, user_id, profiles(full_name, gender, has_wheelchair)")
        .eq("trip_id", tripId)
        .is("cancelled_at", null),
    ]);

    const passengersByBus: Record<string, Passenger[]> = {};
    for (const b of bookingsRes.data || []) {
      const list = passengersByBus[b.bus_id] || [];
      const p = b.profiles as unknown as { full_name: string; gender: string; has_wheelchair: boolean };
      list.push({
        booking_id: b.id,
        user_id: b.user_id,
        full_name: p.full_name,
        gender: p.gender,
        has_wheelchair: p.has_wheelchair,
      });
      passengersByBus[b.bus_id] = list;
    }

    const busesWithPassengers = (busesRes.data || []).map((bus: Bus) => ({
      ...bus,
      passengers: passengersByBus[bus.id] || [],
    }));

    setBuses(busesWithPassengers);
    setLoading(false);
  }

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
      toast.error(t("common.error"));
    } else {
      toast.success(t("admin.passengerMoved"));
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
    setRemoveTarget(null);

    if (error) {
      toast.error(t("common.error"));
    } else {
      toast.success(t("admin.passengerRemoved"));
      logAction("remove_passenger", "booking", bookingId);
      loadBuses();
    }
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
        toast.error(t("common.error"));
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
      if (error) toast.error(t("common.error"));
      else {
        toast.success(t("admin.editBus"));
        logAction("edit_bus", "bus", editingId);
      }
      setSaving(false);
      setShowForm(false);
      loadBuses();
      return;
    }

    if (!form.area_name || form.capacity <= 0 || form.bus_count < 1) {
      toast.error(t("common.error"));
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

    if (error) toast.error(t("common.error"));
    else {
      toast.success(t("admin.createBus"));
      logAction("bulk_create_buses", "bus", undefined, { count: form.bus_count });
    }

    setSaving(false);
    setShowForm(false);
    loadBuses();
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("buses").delete().eq("id", id);
    if (error) toast.error(t("common.error"));
    else {
      toast.success(t("admin.deleteBus"));
      logAction("delete_bus", "bus", id);
      loadBuses();
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 animate-fade-in">
        <div className="w-12 h-12 rounded-full border-4 border-slate-100 dark:border-gray-700 border-t-blue-600 dark:border-t-blue-400 animate-spin" />
        <p className="text-lg text-slate-400 dark:text-gray-400">{t("common.loading")}</p>
      </div>
    );
  }

  const movingBusId = movingPassenger
    ? buses.find((b) => b.passengers.some((p) => p.booking_id === movingPassenger))?.id
    : null;
  const moveTargetBuses = movingBusId ? buses.filter((b) => b.id !== movingBusId) : buses;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">{t("admin.buses")}</h2>
        <Button onClick={startCreate}>
          <Plus /> {t("admin.createBus")}
        </Button>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? t("common.edit") : t("admin.createBus")}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            {editingId ? (
              <div>
                <Label className="mb-1.5">{t("admin.busLabel")}</Label>
                <Input
                  value={form.bus_label}
                  onChange={(e) => setForm({ ...form, bus_label: e.target.value })}
                />
              </div>
            ) : (
              <>
                <div>
                  <Label className="mb-1.5">{t("admin.areaName")}</Label>
                  <Input
                    value={form.area_name}
                    onChange={(e) => setForm({ ...form, area_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="mb-1.5">{t("admin.numberOfBuses")}</Label>
                  <Input
                    type="number"
                    value={form.bus_count || ""}
                    onChange={(e) => setForm({ ...form, bus_count: parseInt(e.target.value) || 1 })}
                    dir="ltr"
                    min={1}
                    max={20}
                  />
                </div>
              </>
            )}
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
              <Label className="mb-1.5">{t("admin.leaderName")}</Label>
              <Input
                value={form.leader_name}
                onChange={(e) => setForm({ ...form, leader_name: e.target.value })}
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
        open={!!deleteBusId}
        onOpenChange={(open) => {
          if (!open) setDeleteBusId(null);
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
                if (deleteBusId) handleDelete(deleteBusId);
              }}
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!movingPassenger} onOpenChange={(open) => { if (!open) setMovingPassenger(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.moveToBus")}</DialogTitle>
          </DialogHeader>
          <div>
            <Label className="mb-1.5">{t("buses.chooseBus")}</Label>
            <Select value={selectedTargetBus} onValueChange={(v) => setSelectedTargetBus(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("admin.selectBus")} />
              </SelectTrigger>
              <SelectContent>
                {moveTargetBuses.map((ob) => (
                  <SelectItem key={ob.id} value={ob.id}>
                    {ob.bus_label || ob.area_name_ar} ({ob.passengers.length}/{ob.capacity})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button onClick={confirmMove} disabled={!selectedTargetBus}>
              {t("admin.book")}
            </Button>
            <Button variant="outline" onClick={() => setMovingPassenger(null)}>
              {t("admin.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!removeTarget}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.confirmRemoveFromBus")}</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget?.name}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (removeTarget) confirmRemove(removeTarget.id);
              }}
            >
              {t("admin.removeFromBus")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {buses.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-lg text-muted-foreground mb-2">{t("admin.noBusesYet")}</p>
          <p className="text-sm text-muted-foreground/60 mb-4">{t("admin.addBusesFirst")}</p>
          <Button onClick={startCreate}>
            <Plus /> {t("admin.createBus")}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {buses.map((bus) => {
            const count = bus.passengers.length;
            const percent = bus.capacity > 0 ? (count / bus.capacity) * 100 : 0;
            const displayName = bus.bus_label || bus.area_name_ar;
            const isExpanded = expandedBusIds.has(bus.id);

            const statusBg =
              percent >= 100
                ? "destructive"
                : percent >= 80
                  ? "secondary"
                  : "outline";

            const progressClassName =
              percent >= 100
                ? "[&_[data-slot=progress-indicator]]:bg-destructive"
                : percent >= 80
                  ? "[&_[data-slot=progress-indicator]]:bg-amber-500"
                  : "";

            return (
              <Card key={bus.id}>
                <CardContent>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <BusIcon className="size-4 text-muted-foreground" />
                      <h3 className="text-base font-bold">{displayName}</h3>
                      <Badge variant={statusBg}>
                        {count}/{bus.capacity}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => toggleExpand(bus.id)}
                      >
                        <ChevronDown className={`transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                        {isExpanded ? t("admin.hidePassengers") : t("admin.showPassengers")}
                        {count > 0 && <span className="ms-1">({count})</span>}
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => startEdit(bus)}
                      >
                        <Pencil /> {t("common.edit")}
                      </Button>
                      <Button
                        variant="destructive"
                        size="xs"
                        onClick={() => setDeleteBusId(bus.id)}
                      >
                        <Trash2 /> {t("common.delete")}
                      </Button>
                    </div>
                  </div>

                  {bus.leader_name && (
                    <p className="text-sm text-muted-foreground mb-1">
                      {t("admin.leaderName")}: {bus.leader_name}
                    </p>
                  )}

                  <div className="flex justify-between text-sm text-muted-foreground mb-1.5">
                    <span>{t("admin.passengers")}: {count}/{bus.capacity}</span>
                    <span className="ms-auto tabular-nums">{Math.round(percent)}%</span>
                  </div>
                  <Progress value={Math.min(percent, 100)} className={progressClassName} />

                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-border">
                      {count === 0 ? (
                        <p className="text-sm text-muted-foreground">{t("admin.noPassengers")}</p>
                      ) : (
                        <div className="space-y-2">
                          {bus.passengers.map((p) => (
                            <div
                              key={p.booking_id}
                              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded-lg bg-muted/50"
                            >
                              <div className="flex items-center gap-2">
                                <User className="size-4 text-muted-foreground" />
                                <span className="text-sm font-medium">
                                  {p.full_name}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {p.gender === "Male" ? "♂" : "♀"}
                                </Badge>
                                {p.has_wheelchair && (
                                  <Badge variant="secondary" className="text-xs">♿</Badge>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                {removingPassenger === p.booking_id ? (
                                  <span className="text-xs text-muted-foreground">{t("common.loading")}</span>
                                ) : (
                                  <>
                                    {buses.filter((b) => b.id !== bus.id).length > 0 && (
                                      <Button
                                        variant="outline"
                                        size="xs"
                                        onClick={() => startMove(p.booking_id)}
                                      >
                                        <ArrowRightLeft /> {t("admin.moveToBus")}
                                      </Button>
                                    )}
                                    <Button
                                      variant="destructive"
                                      size="xs"
                                      onClick={() => setRemoveTarget({ id: p.booking_id, name: p.full_name })}
                                    >
                                      <UserMinus /> {t("admin.removeFromBus")}
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
