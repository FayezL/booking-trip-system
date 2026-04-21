"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useToast } from "@/components/Toast";
import LoadingSpinner from "@/components/LoadingSpinner";
import { logAction } from "@/lib/admin-logs";
import type { Bus } from "@/lib/types/database";

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

export default function BusesTab({ tripId }: { tripId: string }) {
  const { t } = useTranslation();
  const supabase = createClient();
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

  const loadBuses = useCallback(async () => {
    try {
      const [busesRes, bookingsRes] = await Promise.all([
        supabase.from("buses").select("*").eq("trip_id", tripId),
        supabase
          .from("bookings")
          .select("id, bus_id, user_id, family_member_id, profiles(full_name, gender, has_wheelchair, sector_id)")
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
        list.push({
          booking_id: b.id,
          user_id: b.user_id,
          full_name: p.full_name,
          gender: p.gender,
          has_wheelchair: p.has_wheelchair,
          sector_name: p.sector_id ? (sectorMap[p.sector_id] || "") : "",
          family_member_id: (b as { family_member_id?: string | null }).family_member_id || null,
        });
        passengersByBus[b.bus_id] = list;
      }

      const busesWithPassengers = (busesRes.data || []).map((bus: Bus) => ({
        ...bus,
        passengers: passengersByBus[bus.id] || [],
      }));

      setBuses(busesWithPassengers);
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

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-800 dark:text-gray-100">{t("admin.buses")}</h2>
        <button onClick={startCreate} className="btn-primary">
          + {t("admin.createBus")}
        </button>
      </div>

      {showForm && (
        <div className="card mb-4 animate-slide-up">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            {editingId ? (
              <div>
                <label className="label-text">{t("admin.busLabel")}</label>
                <input
                  className="input-field"
                  value={form.bus_label}
                  onChange={(e) => setForm({ ...form, bus_label: e.target.value })}
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="label-text">{t("admin.areaName")}</label>
                  <input
                    className="input-field"
                    value={form.area_name}
                    onChange={(e) => setForm({ ...form, area_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label-text">{t("admin.numberOfBuses")}</label>
                  <input
                    type="number"
                    className="input-field"
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

      {buses.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-lg text-slate-400 dark:text-gray-500 mb-2">{t("admin.noBusesYet")}</p>
          <p className="text-sm text-slate-300 dark:text-gray-600 mb-4">{t("admin.addBusesFirst")}</p>
          <button onClick={startCreate} className="btn-primary">
            + {t("admin.createBus")}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {buses.map((bus) => {
            const count = bus.passengers.length;
            const percent = bus.capacity > 0 ? (count / bus.capacity) * 100 : 0;
            const displayName = bus.bus_label || bus.area_name_ar;
            const isExpanded = expandedBusIds.has(bus.id);
            const otherBuses = buses.filter((b) => b.id !== bus.id);

            const statusBg =
              percent >= 100
                ? "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400"
                : percent >= 80
                  ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400"
                  : "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400";
            const fillClass = percent >= 100 ? "danger" : percent >= 80 ? "warning" : "";

            return (
              <div key={bus.id} className="card">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-800 dark:text-gray-100">{displayName}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBg}`}>
                      {count}/{bus.capacity}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleExpand(bus.id)}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-50 dark:bg-gray-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 active:scale-95 transition-all duration-150"
                    >
                      {isExpanded ? t("admin.hidePassengers") : t("admin.showPassengers")}
                      {count > 0 && <span className="ms-1">({count})</span>}
                    </button>
                    <button
                      onClick={() => startEdit(bus)}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-50 dark:bg-gray-800 text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700 active:scale-95 transition-all duration-150"
                    >
                      {t("common.edit")}
                    </button>
                    <button
                      onClick={() => handleDelete(bus.id)}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/50 active:scale-95 transition-all duration-150"
                    >
                      {t("common.delete")}
                    </button>
                  </div>
                </div>

                {bus.leader_name && (
                  <p className="text-sm text-slate-400 dark:text-gray-500 mb-1">
                    {t("admin.leaderName")}: {bus.leader_name}
                  </p>
                )}

                <div className="flex justify-between text-sm text-slate-400 dark:text-gray-500 mb-1.5">
                  <span>{t("admin.passengers")}: {count}/{bus.capacity}</span>
                  <span>{Math.round(percent)}%</span>
                </div>
                <div className="progress-bar">
                  <div
                    className={`progress-bar-fill ${fillClass}`}
                    style={{ width: `${Math.min(percent, 100)}%` }}
                  />
                </div>

                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-gray-800 animate-slide-up">
                    {count === 0 ? (
                      <p className="text-sm text-slate-400 dark:text-gray-500">{t("admin.noPassengers")}</p>
                    ) : (
                      <div className="space-y-2">
                        {bus.passengers.map((p) => (
                          <div
                            key={p.booking_id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 dark:bg-gray-800/50"
                          >
                            <div className="flex items-center gap-2">
                              {p.family_member_id && (
                                <span className="text-xs text-purple-400 dark:text-purple-500">↳</span>
                              )}
                              <span className="text-sm font-medium text-slate-700 dark:text-gray-200">
                                {p.full_name}
                              </span>
                              <span
                                className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                                  p.gender === "Male"
                                    ? "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400"
                                    : "bg-pink-50 dark:bg-pink-950/30 text-pink-600 dark:text-pink-400"
                                }`}
                              >
                                {p.gender === "Male" ? "♂" : "♀"}
                              </span>
                              {p.has_wheelchair && (
                                <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400">♿</span>
                              )}
                              {p.sector_name && (
                                <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-400">
                                  {p.sector_name}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              {movingPassenger === p.booking_id ? (
                                <div className="flex items-center gap-2">
                                  <select
                                    className="input-field !py-1 !text-xs !w-auto min-w-[120px]"
                                    value={selectedTargetBus}
                                    onChange={(e) => setSelectedTargetBus(e.target.value)}
                                  >
                                    <option value="">{t("admin.selectBus")}</option>
                                    {otherBuses.map((ob) => (
                                      <option key={ob.id} value={ob.id}>
                                        {ob.bus_label || ob.area_name_ar} ({ob.passengers.length}/{ob.capacity})
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    onClick={confirmMove}
                                    disabled={!selectedTargetBus}
                                    className="px-2 py-1 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 active:scale-95 transition-all duration-150"
                                  >
                                    {t("admin.book")}
                                  </button>
                                  <button
                                    onClick={() => setMovingPassenger(null)}
                                    className="px-2 py-1 rounded-lg text-xs font-medium bg-slate-200 dark:bg-gray-700 text-slate-600 dark:text-gray-300 hover:bg-slate-300 dark:hover:bg-gray-600 active:scale-95 transition-all duration-150"
                                  >
                                    {t("admin.cancel")}
                                  </button>
                                </div>
                              ) : removingPassenger === p.booking_id ? (
                                <span className="text-xs text-slate-400 dark:text-gray-500">{t("common.loading")}</span>
                              ) : (
                                <>
                                  {otherBuses.length > 0 && (
                                    <button
                                      onClick={() => startMove(p.booking_id)}
                                      className="px-2 py-1 rounded-lg text-xs font-medium bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950/50 active:scale-95 transition-all duration-150"
                                    >
                                      {t("admin.moveToBus")}
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleRemovePassenger(p.booking_id, p.full_name)}
                                    className="px-2 py-1 rounded-lg text-xs font-medium bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/50 active:scale-95 transition-all duration-150"
                                  >
                                    {t("admin.removeFromBus")}
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {movingPassenger && (
        <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setMovingPassenger(null)} />
      )}
    </div>
  );
}
