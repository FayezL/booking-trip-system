"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useToast } from "@/components/Toast";
import LoadingSpinner from "@/components/LoadingSpinner";
import { logAction } from "@/lib/admin-logs";
import type { Car, Profile } from "@/lib/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Car as CarIcon, Plus, Trash2, UserPlus } from "lucide-react";

type CarPassenger = {
  booking_id: string;
  user_id: string;
  full_name: string;
  gender: string;
};

type CarWithPassengers = Car & {
  driver_name: string;
  passengers: CarPassenger[];
};

type UnbookedPerson = {
  booking_id: string;
  full_name: string;
  user_id: string;
};

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export default function CarsTab({ tripId }: { tripId: string }) {
  const { t } = useTranslation();
  const supabase = createClient();
  const { showToast } = useToast();

  const [cars, setCars] = useState<CarWithPassengers[]>([]);
  const [unbookedPassengers, setUnbookedPassengers] = useState<UnbookedPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddCar, setShowAddCar] = useState(false);
  const [servants, setServants] = useState<Profile[]>([]);
  const [addForm, setAddForm] = useState({ driver_id: "", capacity: 4 });
  const [saving, setSaving] = useState(false);
  const [assigningCar, setAssigningCar] = useState<string | null>(null);
  const [selectedPassenger, setSelectedPassenger] = useState<string>("");

  const loadData = useCallback(async () => {
    try {
      const [carsRes, bookingsRes, profilesRes] = await Promise.all([
        supabase.from("cars").select("*").eq("trip_id", tripId),
        supabase
          .from("bookings")
          .select("id, user_id, car_id, profiles(full_name, gender)")
          .eq("trip_id", tripId)
          .is("cancelled_at", null),
        supabase.from("profiles").select("id, full_name, has_car, car_seats, role").is("deleted_at", null),
      ]);

      const driverMap: Record<string, string> = {};
      for (const p of (profilesRes.data || []) as Profile[]) {
        driverMap[p.id] = p.full_name;
      }

      const passengersByCar: Record<string, CarPassenger[]> = {};
      const bookedUserIds = new Set<string>();

      for (const b of bookingsRes.data || []) {
        bookedUserIds.add(b.user_id);
        const prof = b.profiles as unknown as { full_name: string; gender: string };
        const passenger: CarPassenger = {
          booking_id: b.id,
          user_id: b.user_id,
          full_name: prof.full_name,
          gender: prof.gender,
        };

        if (b.car_id) {
          const list = passengersByCar[b.car_id] || [];
          list.push(passenger);
          passengersByCar[b.car_id] = list;
        }
      }

      const carsWithPassengers = (carsRes.data || []).map((car: Car) => ({
        ...car,
        driver_name: car.driver_id ? (driverMap[car.driver_id] || t("cars.driver")) : t("cars.driver"),
        passengers: passengersByCar[car.id] || [],
      }));

      setCars(carsWithPassengers);

      const unbooked: UnbookedPerson[] = [];
      for (const b of bookingsRes.data || []) {
        if (!b.car_id) {
          const prof = b.profiles as unknown as { full_name: string };
          unbooked.push({
            booking_id: b.id,
            full_name: prof.full_name,
            user_id: b.user_id,
          });
        }
      }
      setUnbookedPassengers(unbooked);

      const servantList = (profilesRes.data || []).filter(
        (p: Profile) => p.has_car && p.role === "servant"
      );
      setServants(servantList as Profile[]);
    } catch {
      showToast(t("common.error"), "error");
    } finally {
      setLoading(false);
    }
  }, [tripId, supabase, showToast, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleAddCar() {
    if (!addForm.driver_id || addForm.capacity < 1) {
      showToast(t("common.error"), "error");
      return;
    }

    setSaving(true);
    const { error } = await supabase.rpc("admin_create_car", {
      p_trip_id: tripId,
      p_driver_id: addForm.driver_id,
      p_capacity: addForm.capacity,
    });
    setSaving(false);

    if (error) {
      showToast(t("common.error"), "error");
    } else {
      showToast(t("cars.addCar"), "success");
      logAction("create_car", "car", undefined, { driver: addForm.driver_id });
      setShowAddCar(false);
      setAddForm({ driver_id: "", capacity: 4 });
      loadData();
    }
  }

  async function handleRemoveCar(carId: string, carLabel: string) {
    if (!confirm(t("cars.confirmRemove"))) return;

    const { error } = await supabase.rpc("remove_car", { p_car_id: carId });

    if (error) {
      showToast(t("common.error"), "error");
    } else {
      showToast(t("cars.carRemoved"), "success");
      logAction("remove_car", "car", carId, { label: carLabel });
      loadData();
    }
  }

  async function handleAssignPassenger(carId: string) {
    if (!selectedPassenger) {
      showToast(t("common.error"), "error");
      return;
    }

    const { error } = await supabase.rpc("assign_car_passenger", {
      p_booking_id: selectedPassenger,
      p_car_id: carId,
    });

    if (error) {
      if (error.message.includes("full")) {
        showToast(t("cars.carFull"), "error");
      } else {
        showToast(t("common.error"), "error");
      }
    } else {
      showToast(t("cars.assigned"), "success");
      logAction("assign_car_passenger", "booking", selectedPassenger, { car: carId });
      setAssigningCar(null);
      setSelectedPassenger("");
      loadData();
    }
  }

  if (loading) {
    return <LoadingSpinner text={t("common.loading")} />;
  }

  function getCapacityVariant(isFull: boolean): "default" | "destructive" {
    return isFull ? "destructive" : "default";
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CarIcon className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{t("cars.title")}</h2>
        </div>
        <Button onClick={() => setShowAddCar(!showAddCar)} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          {t("cars.addCar")}
        </Button>
      </div>

      <Dialog open={showAddCar} onOpenChange={setShowAddCar}>
        <DialogContent className="sm:max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>{t("cars.addCar")}</DialogTitle>
            <DialogDescription>{t("cars.driver")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1.5 block">{t("cars.driver")}</label>
              <select
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={addForm.driver_id}
                onChange={(e) => setAddForm({ ...addForm, driver_id: e.target.value })}
              >
                <option value="">---</option>
                {servants.map((s) => (
                  <option key={s.id} value={s.id}>{s.full_name} ({s.car_seats} {t("cars.seats")})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1.5 block">{t("cars.capacity")}</label>
              <input
                type="number"
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={addForm.capacity || ""}
                onChange={(e) => setAddForm({ ...addForm, capacity: parseInt(e.target.value) || 1 })}
                dir="ltr"
                min="1"
                max="20"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button onClick={handleAddCar} disabled={saving}>
              {saving ? t("common.loading") : t("cars.addCar")}
            </Button>
            <Button variant="outline" onClick={() => setShowAddCar(false)}>
              {t("admin.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!assigningCar} onOpenChange={(open) => { if (!open) { setAssigningCar(null); setSelectedPassenger(""); } }}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{t("cars.assign")}</DialogTitle>
            <DialogDescription>{t("cars.selectCar")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {unbookedPassengers.map((p) => (
              <button
                key={p.booking_id}
                onClick={() => setSelectedPassenger(p.booking_id)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-right",
                  selectedPassenger === p.booking_id
                    ? "border-primary bg-primary/5"
                    : "border-transparent bg-muted/50 hover:bg-muted"
                )}
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">{getInitials(p.full_name)}</AvatarFallback>
                </Avatar>
                <span className="font-medium text-sm">{p.full_name}</span>
              </button>
            ))}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button onClick={() => assigningCar && handleAssignPassenger(assigningCar)} disabled={!selectedPassenger} className="gap-2">
              <UserPlus className="h-4 w-4" />
              {t("cars.assign")}
            </Button>
            <Button variant="outline" onClick={() => { setAssigningCar(null); setSelectedPassenger(""); }}>
              {t("admin.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {cars.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CarIcon className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <p className="text-lg text-muted-foreground">{t("cars.noCars")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cars.map((car) => {
            const seatsTaken = car.passengers.length;
            const available = car.capacity - seatsTaken;
            const isFull = available <= 0;
            const percent = car.capacity > 0 ? (seatsTaken / car.capacity) * 100 : 0;

            return (
              <Card key={car.id}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                        <CarIcon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold">{car.car_label || t("cars.title")}</h3>
                        <p className="text-xs text-muted-foreground">
                          {t("cars.driver")}: {car.driver_name}
                        </p>
                      </div>
                      <Badge variant={getCapacityVariant(isFull)} className="text-xs">
                        {seatsTaken}/{car.capacity}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {unbookedPassengers.length > 0 && !isFull && (
                        <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => { setAssigningCar(car.id); setSelectedPassenger(""); }}>
                          <UserPlus className="h-3.5 w-3.5" />
                          {t("cars.assign")}
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-8 text-xs gap-1 text-red-600 hover:text-red-700 dark:text-red-400" onClick={() => handleRemoveCar(car.id, car.car_label || "")}>
                        <Trash2 className="h-3.5 w-3.5" />
                        {t("cars.remove")}
                      </Button>
                    </div>
                  </div>

                  <div className="flex justify-between text-sm text-muted-foreground mb-1.5">
                    <span>{t("cars.available")}: {available}</span>
                    <span>{Math.round(percent)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        isFull ? "bg-red-500" : percent >= 80 ? "bg-amber-500" : "bg-blue-500"
                      )}
                      style={{ width: `${Math.min(percent, 100)}%` }}
                    />
                  </div>

                  {car.passengers.length > 0 && (
                    <div className="mt-3 pt-3 border-t space-y-1.5">
                      {car.passengers.map((p) => (
                        <div key={p.booking_id} className="flex items-center gap-2.5 p-2 rounded-lg bg-muted/50">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className={cn("text-[10px]", p.gender === "Male" ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300" : "bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300")}>
                              {getInitials(p.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">{p.full_name}</span>
                          <Badge variant="outline" className={cn("text-[10px] px-1.5", p.gender === "Male" ? "border-blue-300 text-blue-600 dark:text-blue-400" : "border-pink-300 text-pink-600 dark:text-pink-400")}>
                            {p.gender === "Male" ? "♂" : "♀"}
                          </Badge>
                        </div>
                      ))}
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
