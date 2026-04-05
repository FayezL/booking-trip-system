"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useToast } from "@/components/Toast";
import LoadingSpinner from "@/components/LoadingSpinner";
import { logAction } from "@/lib/admin-logs";
import type { Bus } from "@/lib/types/database";

type BusWithCount = Bus & { booking_count: number };

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
    const [busesRes, bookingsRes] = await Promise.all([
      supabase.from("buses").select("*").eq("trip_id", tripId),
      supabase.from("bookings").select("bus_id").eq("trip_id", tripId).is("cancelled_at", null),
    ]);

    const bookingCounts: Record<string, number> = {};
    for (const b of bookingsRes.data || []) {
      bookingCounts[b.bus_id] = (bookingCounts[b.bus_id] || 0) + 1;
    }

    const busesWithCounts = (busesRes.data || []).map((bus: Bus) => ({
      ...bus,
      booking_count: bookingCounts[bus.id] || 0,
    }));

    setBuses(busesWithCounts);
    setLoading(false);
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
            const percent = bus.capacity > 0 ? (bus.booking_count / bus.capacity) * 100 : 0;
            const displayName = bus.bus_label || bus.area_name_ar;
            const statusBg = percent >= 80
              ? "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400"
              : percent >= 50
                ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400"
                : "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400";
            const fillClass = percent >= 80 ? "danger" : percent >= 50 ? "warning" : "";
            return (
              <div key={bus.id} className="card">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-800 dark:text-gray-100">{displayName}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBg}`}>
                      {bus.booking_count}/{bus.capacity}
                    </span>
                  </div>
                  <div className="flex gap-2">
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
                  <span>{t("admin.passengers")}: {bus.booking_count}/{bus.capacity}</span>
                  <span>{Math.round(percent)}%</span>
                </div>
                <div className="progress-bar">
                  <div
                    className={`progress-bar-fill ${fillClass}`}
                    style={{ width: `${Math.min(percent, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
