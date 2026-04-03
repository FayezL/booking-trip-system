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
  area_name_ar: string;
  area_name_en: string;
  capacity: number;
  leader_name: string;
};

const emptyForm: BusForm = {
  area_name_ar: "",
  area_name_en: "",
  capacity: 0,
  leader_name: "",
};

export default function BusesTab({ tripId }: { tripId: string }) {
  const { t, lang } = useTranslation();
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
      area_name_ar: bus.area_name_ar,
      area_name_en: bus.area_name_en,
      capacity: bus.capacity,
      leader_name: bus.leader_name || "",
    });
    setShowForm(true);
  }

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.area_name_ar || !form.area_name_en || form.capacity <= 0) {
      showToast(t("common.error"), "error");
      return;
    }

    setSaving(true);

    if (editingId) {
      const { error } = await supabase
        .from("buses")
        .update(form)
        .eq("id", editingId);
      if (error) showToast(t("common.error"), "error");
      else {
        showToast(t("admin.editBus"), "success");
        logAction("edit_bus", "bus", editingId);
      }
    } else {
      const { error } = await supabase
        .from("buses")
        .insert({ ...form, trip_id: tripId });
      if (error) showToast(t("common.error"), "error");
      else {
        showToast(t("admin.createBus"), "success");
        logAction("create_bus", "bus");
      }
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
            <div>
              <label className="label-text">{t("admin.areaNameAr")}</label>
              <input
                className="input-field"
                value={form.area_name_ar}
                onChange={(e) => setForm({ ...form, area_name_ar: e.target.value })}
              />
            </div>
            <div>
              <label className="label-text">{t("admin.areaNameEn")}</label>
              <input
                className="input-field"
                value={form.area_name_en}
                onChange={(e) => setForm({ ...form, area_name_en: e.target.value })}
                dir="ltr"
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
          return (
            <div key={bus.id} className="card">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-lg font-bold">
                    {lang === "ar" ? bus.area_name_ar : bus.area_name_en}
                  </h3>
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
