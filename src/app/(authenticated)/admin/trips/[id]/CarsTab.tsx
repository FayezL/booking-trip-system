"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useToast } from "@/components/Toast";
import LoadingSpinner from "@/components/LoadingSpinner";
import { logAction } from "@/lib/admin-logs";
import type { Car, Profile } from "@/lib/types/database";

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

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-800 dark:text-gray-100">{t("cars.title")}</h2>
        <button onClick={() => setShowAddCar(!showAddCar)} className="btn-primary">
          + {t("cars.addCar")}
        </button>
      </div>

      {showAddCar && (
        <div className="card mb-4 animate-slide-up">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <div>
              <label className="label-text">{t("cars.driver")}</label>
              <select
                className="input-field"
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
              <label className="label-text">{t("cars.capacity")}</label>
              <input
                type="number"
                className="input-field"
                value={addForm.capacity || ""}
                onChange={(e) => setAddForm({ ...addForm, capacity: parseInt(e.target.value) || 1 })}
                dir="ltr"
                min="1"
                max="20"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <button onClick={handleAddCar} disabled={saving} className="btn-primary w-full sm:w-auto">
              {saving ? t("common.loading") : t("cars.addCar")}
            </button>
            <button onClick={() => setShowAddCar(false)} className="btn-secondary w-full sm:w-auto">
              {t("admin.cancel")}
            </button>
          </div>
        </div>
      )}

      {cars.length === 0 ? (
        <div className="text-center py-10">
          <div className="w-16 h-16 bg-slate-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-slate-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h8m-8 4h4m-2 8H6a2 2 0 01-2-2V7a2 2 0 012-2h12a2 2 0 012 2v6" />
            </svg>
          </div>
          <p className="text-lg text-slate-400 dark:text-gray-500">{t("cars.noCars")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cars.map((car) => {
            const seatsTaken = car.passengers.length;
            const available = car.capacity - seatsTaken;
            const isFull = available <= 0;

            return (
              <div key={car.id} className="card">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 17h8M8 17v4h8v-4M8 17l-2-7h12l-2 7" />
                    </svg>
                    <h3 className="text-base font-bold text-slate-800 dark:text-gray-100">{car.car_label || t("cars.title")}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      isFull
                        ? "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400"
                        : "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400"
                    }`}>
                      {seatsTaken}/{car.capacity}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {unbookedPassengers.length > 0 && !isFull && (
                      <button
                        onClick={() => { setAssigningCar(car.id); setSelectedPassenger(""); }}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950/50 active:scale-95 transition-all duration-150"
                      >
                        {t("cars.assign")}
                      </button>
                    )}
                    <button
                      onClick={() => handleRemoveCar(car.id, car.car_label || "")}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/50 active:scale-95 transition-all duration-150"
                    >
                      {t("cars.remove")}
                    </button>
                  </div>
                </div>

                <p className="text-sm text-slate-400 dark:text-gray-500 mb-2">
                  {t("cars.driver")}: {car.driver_name} — {t("cars.available")}: {available}
                </p>

                {car.passengers.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 dark:border-gray-800">
                    <div className="space-y-1">
                      {car.passengers.map((p) => (
                        <div key={p.booking_id} className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-50 dark:bg-gray-800/50">
                          <span className="text-sm font-medium text-slate-700 dark:text-gray-200">
                            {p.full_name}
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                            p.gender === "Male"
                              ? "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400"
                              : "bg-pink-50 dark:bg-pink-950/30 text-pink-600 dark:text-pink-400"
                          }`}>
                            {p.gender === "Male" ? "♂" : "♀"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {assigningCar === car.id && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-gray-800 animate-slide-up">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <select
                        className="input-field flex-1"
                        value={selectedPassenger}
                        onChange={(e) => setSelectedPassenger(e.target.value)}
                      >
                        <option value="">{t("cars.selectCar")}</option>
                        {unbookedPassengers.map((p) => (
                          <option key={p.booking_id} value={p.booking_id}>{p.full_name}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleAssignPassenger(car.id)}
                        disabled={!selectedPassenger}
                        className="btn-primary w-full sm:w-auto"
                      >
                        {t("cars.assign")}
                      </button>
                      <button
                        onClick={() => { setAssigningCar(null); setSelectedPassenger(""); }}
                        className="btn-secondary w-full sm:w-auto"
                      >
                        {t("admin.cancel")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
