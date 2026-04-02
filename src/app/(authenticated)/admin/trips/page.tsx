"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useToast } from "@/components/Toast";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { Trip } from "@/lib/types/database";

type TripForm = {
  title_ar: string;
  title_en: string;
  trip_date: string;
  is_open: boolean;
};

const emptyForm: TripForm = {
  title_ar: "",
  title_en: "",
  trip_date: "",
  is_open: true,
};

export default function TripsManagementPage() {
  const { t, lang } = useTranslation();
  const supabase = createClient();
  const { showToast } = useToast();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TripForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTrips();
  }, []);

  async function loadTrips() {
    const { data } = await supabase
      .from("trips")
      .select("*")
      .order("trip_date", { ascending: false });
    setTrips(data || []);
    setLoading(false);
  }

  function startEdit(trip: Trip) {
    setEditingId(trip.id);
    setForm({
      title_ar: trip.title_ar,
      title_en: trip.title_en,
      trip_date: trip.trip_date,
      is_open: trip.is_open,
    });
    setShowForm(true);
  }

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.title_ar || !form.title_en || !form.trip_date) {
      showToast(t("common.error"), "error");
      return;
    }

    setSaving(true);

    if (editingId) {
      const { error } = await supabase
        .from("trips")
        .update(form)
        .eq("id", editingId);
      if (error) {
        showToast(t("common.error"), "error");
      } else {
        showToast(t("admin.editTrip"), "success");
      }
    } else {
      const { error } = await supabase.from("trips").insert(form);
      if (error) {
        showToast(t("common.error"), "error");
      } else {
        showToast(t("admin.createTrip"), "success");
      }
    }

    setSaving(false);
    setShowForm(false);
    loadTrips();
  }

  async function handleDelete(id: string) {
    if (!confirm(t("admin.confirmDelete"))) return;

    const { error } = await supabase.from("trips").delete().eq("id", id);
    if (error) {
      showToast(t("common.error"), "error");
    } else {
      showToast(t("admin.deleteTrip"), "success");
      loadTrips();
    }
  }

  async function toggleOpen(trip: Trip) {
    const { error } = await supabase
      .from("trips")
      .update({ is_open: !trip.is_open })
      .eq("id", trip.id);
    if (!error) loadTrips();
  }

  if (loading) {
    return <LoadingSpinner text={t("common.loading")} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t("admin.trips")}</h1>
        <button onClick={startCreate} className="btn-primary">
          + {t("admin.createTrip")}
        </button>
      </div>

      {showForm && (
        <div className="card mb-6">
          <h2 className="text-xl font-bold mb-4">
            {editingId ? t("admin.editTrip") : t("admin.createTrip")}
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label-text">{t("admin.tripTitleAr")}</label>
              <input
                className="input-field"
                value={form.title_ar}
                onChange={(e) => setForm({ ...form, title_ar: e.target.value })}
              />
            </div>
            <div>
              <label className="label-text">{t("admin.tripTitleEn")}</label>
              <input
                className="input-field"
                value={form.title_en}
                onChange={(e) => setForm({ ...form, title_en: e.target.value })}
                dir="ltr"
              />
            </div>
            <div>
              <label className="label-text">{t("admin.tripDate")}</label>
              <input
                type="date"
                className="input-field"
                value={form.trip_date}
                onChange={(e) => setForm({ ...form, trip_date: e.target.value })}
                dir="ltr"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => setForm({ ...form, is_open: !form.is_open })}
                className={`px-4 py-3 rounded-lg font-semibold min-h-[48px] ${
                  form.is_open
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                {form.is_open ? t("admin.isOpen") : t("admin.isClosed")}
              </button>
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
        {trips.map((trip) => (
          <div key={trip.id} className="card">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">
                  {lang === "ar" ? trip.title_ar : trip.title_en}
                </h3>
                <p className="text-sm text-gray-500">{trip.trip_date}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleOpen(trip)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                    trip.is_open
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {trip.is_open ? t("admin.isOpen") : t("admin.isClosed")}
                </button>
                <button
                  onClick={() => startEdit(trip)}
                  className="px-3 py-1.5 rounded-md text-sm font-medium bg-blue-100 text-blue-700 hover:bg-blue-200"
                >
                  {t("common.edit")}
                </button>
                <button
                  onClick={() => handleDelete(trip.id)}
                  className="px-3 py-1.5 rounded-md text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200"
                >
                  {t("common.delete")}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
