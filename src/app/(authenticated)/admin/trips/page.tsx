"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useToast } from "@/components/Toast";
import LoadingSpinner from "@/components/LoadingSpinner";
import { logAction } from "@/lib/admin-logs";
import type { Trip } from "@/lib/types/database";

type TripWithCount = Trip & { booking_count: number };

type TripForm = {
  title: string;
  trip_date: string;
  is_open: boolean;
};

const emptyForm: TripForm = {
  title: "",
  trip_date: "",
  is_open: true,
};

export default function TripsManagementPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const supabase = createClient();
  const { showToast } = useToast();

  const [trips, setTrips] = useState<TripWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TripForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadTrips = useCallback(async () => {
    try {
      const [tripsRes, bookingsRes] = await Promise.all([
        supabase.from("trips").select("*").order("trip_date", { ascending: false }),
        supabase.from("bookings").select("trip_id").is("cancelled_at", null),
      ]);

      const countMap: Record<string, number> = {};
      for (const b of bookingsRes.data || []) {
        countMap[b.trip_id] = (countMap[b.trip_id] || 0) + 1;
      }

      const tripsWithCounts = (tripsRes.data || []).map((trip: Trip) => ({
        ...trip,
        booking_count: countMap[trip.id] || 0,
      }));
      setTrips(tripsWithCounts);
    } catch {
      showToast(t("common.error"), "error");
    } finally {
      setLoading(false);
    }
  }, [supabase, showToast, t]);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  function startEdit(trip: Trip) {
    setEditingId(trip.id);
    setForm({
      title: trip.title_ar,
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
    if (!form.title || !form.trip_date) {
      showToast(t("common.error"), "error");
      return;
    }

    setSaving(true);

    const payload = {
      title_ar: form.title,
      title_en: form.title,
      trip_date: form.trip_date,
      is_open: form.is_open,
    };

    if (editingId) {
      const { error } = await supabase
        .from("trips")
        .update(payload)
        .eq("id", editingId);
      if (error) {
        showToast(t("common.error"), "error");
      } else {
        showToast(t("admin.editTrip"), "success");
        logAction("edit_trip", "trip", editingId);
      }
    } else {
      const { error } = await supabase.from("trips").insert(payload);
      if (error) {
        showToast(t("common.error"), "error");
      } else {
        showToast(t("admin.createTrip"), "success");
        logAction("create_trip", "trip");
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
      logAction("delete_trip", "trip", id);
      loadTrips();
    }
  }

  async function toggleOpen(trip: Trip) {
    const { error } = await supabase
      .from("trips")
      .update({ is_open: !trip.is_open })
      .eq("id", trip.id);
    if (!error) {
      logAction("toggle_trip", "trip", trip.id);
      loadTrips();
    }
  }

  if (loading) {
    return <LoadingSpinner text={t("common.loading")} />;
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="section-title">{t("admin.trips")}</h1>
        <button onClick={startCreate} className="btn-primary">
          + {t("admin.createTrip")}
        </button>
      </div>

      {showForm && (
        <div className="card mb-6 animate-slide-up">
          <h2 className="text-lg font-bold text-slate-800 dark:text-gray-100 mb-4">
            {editingId ? t("admin.editTrip") : t("admin.createTrip")}
          </h2>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <div>
              <label className="label-text">{t("admin.tripTitle")}</label>
              <input
                className="input-field"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
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
                className={`px-4 py-3 rounded-xl font-semibold min-h-[48px] transition-all duration-150 ${
                  form.is_open
                    ? "bg-blue-50 text-blue-700 border-2 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800"
                    : "bg-slate-100 text-slate-500 border-2 border-slate-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"
                }`}
              >
                {form.is_open ? t("admin.isOpen") : t("admin.isClosed")}
              </button>
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

      <div className="space-y-3">
        {trips.map((trip) => (
          <div key={trip.id} className="card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-gray-100">{trip.title_ar}</h3>
                <p className="text-sm text-slate-400 dark:text-gray-500">{trip.trip_date}</p>
                <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400">
                  {trip.booking_count} {t("admin.bookedCount")}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => router.push(`/admin/trips/${trip.id}`)}
                  className="px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 dark:hover:bg-blue-950/50 hover:bg-blue-100 active:scale-95 transition-all duration-150 min-h-[40px]"
                >
                  {t("admin.manage")}
                </button>
                <button
                  onClick={() => toggleOpen(trip)}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium active:scale-95 transition-all duration-150 min-h-[40px] ${
                    trip.is_open
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                      : "bg-slate-100 text-slate-500 dark:bg-gray-800 dark:text-gray-400"
                  }`}
                >
                  {trip.is_open ? t("admin.isOpen") : t("admin.isClosed")}
                </button>
                <button
                  onClick={() => startEdit(trip)}
                  className="px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-slate-50 text-slate-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 hover:bg-slate-100 active:scale-95 transition-all duration-150 min-h-[40px]"
                >
                  {t("common.edit")}
                </button>
                <button
                  onClick={() => handleDelete(trip.id)}
                  className="px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50 hover:bg-red-100 active:scale-95 transition-all duration-150 min-h-[40px]"
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
