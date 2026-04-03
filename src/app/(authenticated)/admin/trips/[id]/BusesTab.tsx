"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useToast } from "@/components/Toast";
import LoadingSpinner from "@/components/LoadingSpinner";
import { logAction } from "@/lib/admin-logs";
import type { Bus, Area } from "@/lib/types/database";

type BusWithCount = Bus & { booking_count: number };

type BusForm = {
  area_id: string;
  area_name_ar: string;
  area_name_en: string;
  capacity: number;
  leader_name: string;
  bus_label: string;
  bus_count: number;
};

const emptyForm: BusForm = {
  area_id: "",
  area_name_ar: "",
  area_name_en: "",
  capacity: 0,
  leader_name: "",
  bus_label: "",
  bus_count: 1,
};

export default function BusesTab({ tripId }: { tripId: string }) {
  const { t, lang } = useTranslation();
  const supabase = createClient();
  const { showToast } = useToast();

  const [buses, setBuses] = useState<BusWithCount[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BusForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadBuses();
    loadAreas();
  }, [tripId]);

  async function loadAreas() {
    const { data } = await supabase
      .from("areas")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");
    setAreas(data || []);
  }

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
      area_id: bus.area_id || "",
      area_name_ar: bus.area_name_ar,
      area_name_en: bus.area_name_en,
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

    if (!form.area_id || form.capacity <= 0 || form.bus_count < 1) {
      showToast(t("common.error"), "error");
      return;
    }

    setSaving(true);

    const area = areas.find((a) => a.id === form.area_id);
    if (!area) {
      setSaving(false);
      return;
    }

    const existingLabels = buses
      .filter((b) => b.area_id === form.area_id)
      .map((b) => b.bus_label || "");

    const areaName = area.name_ar;
    const busesToCreate = [];
    let labelIndex = 1;

    for (let i = 0; i < form.bus_count; i++) {
      let label = `${areaName} Bus ${labelIndex}`;
      while (existingLabels.includes(label)) {
        labelIndex++;
        label = `${areaName} Bus ${labelIndex}`;
      }
      existingLabels.push(label);
      busesToCreate.push({
        trip_id: tripId,
        area_id: form.area_id,
        area_name_ar: area.name_ar,
        area_name_en: area.name_en,
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
        <h2 className="text-xl font-bold">{t("admin.buses")}</h2>
        <button onClick={startCreate} className="btn-primary">
          + {t("admin.createBus")}
        </button>
      </div>

      {showForm && (
        <div className="card mb-4">
          <div className="grid gap-4 md:grid-cols-2">
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
                  <label className="label-text">{t("admin.areas")}</label>
                  <select
                    className="input-field"
                    value={form.area_id}
                    onChange={(e) => {
                      const area = areas.find((a) => a.id === e.target.value);
                      setForm({
                        ...form,
                        area_id: e.target.value,
                        area_name_ar: area?.name_ar || "",
                        area_name_en: area?.name_en || "",
                      });
                    }}
                  >
                    <option value="">---</option>
                    {areas.map((area) => (
                      <option key={area.id} value={area.id}>
                        {lang === "ar" ? area.name_ar : area.name_en}
                      </option>
                    ))}
                  </select>
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

      <div className="space-y-3">
        {buses.map((bus) => {
          const percent = bus.capacity > 0 ? (bus.booking_count / bus.capacity) * 100 : 0;
          const displayName = bus.bus_label || (lang === "ar" ? bus.area_name_ar : bus.area_name_en);
          return (
            <div key={bus.id} className="card">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-lg font-bold">{displayName}</h3>
                  {bus.leader_name && (
                    <p className="text-sm text-gray-500">
                      {t("admin.leaderName")}: {bus.leader_name}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => startEdit(bus)}
                    className="px-3 py-1.5 rounded-md text-sm font-medium bg-blue-100 text-blue-700 hover:bg-blue-200"
                  >
                    {t("common.edit")}
                  </button>
                  <button
                    onClick={() => handleDelete(bus.id)}
                    className="px-3 py-1.5 rounded-md text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200"
                  >
                    {t("common.delete")}
                  </button>
                </div>
              </div>
              <div className="flex justify-between text-sm text-gray-500 mb-1">
                <span>{t("admin.passengers")}: {bus.booking_count}/{bus.capacity}</span>
                <span>{Math.round(percent)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.min(percent, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
