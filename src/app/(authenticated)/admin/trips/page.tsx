"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useToast } from "@/components/Toast";
import LoadingSpinner from "@/components/LoadingSpinner";
import { logAction } from "@/lib/admin-logs";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Edit,
  Trash2,
  Calendar,
  Users,
  Eye,
  Lock,
  Unlock,
} from "lucide-react";
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
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="section-title">{t("admin.trips")}</h1>
        <Button onClick={startCreate}>
          <Plus className="w-5 h-5" />
          {t("admin.createTrip")}
        </Button>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? t("admin.editTrip") : t("admin.createTrip")}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1.5">
                {t("admin.tripTitle")}
              </label>
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1.5">
                {t("admin.tripDate")}
              </label>
              <input
                type="date"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base min-h-[48px] transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                value={form.trip_date}
                onChange={(e) => setForm({ ...form, trip_date: e.target.value })}
                dir="ltr"
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant={form.is_open ? "default" : "secondary"}
                onClick={() => setForm({ ...form, is_open: !form.is_open })}
                className="w-full"
              >
                {form.is_open ? (
                  <><Unlock className="w-4 h-4" /> {t("admin.isOpen")}</>
                ) : (
                  <><Lock className="w-4 h-4" /> {t("admin.isClosed")}</>
                )}
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowForm(false)}>
              {t("admin.cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? t("common.loading") : t("admin.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-4">
        {trips.map((trip) => (
          <Card key={trip.id} className="transition-shadow duration-200 hover:shadow-md">
            <CardHeader className="pb-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/30 shrink-0">
                    <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-slate-800 dark:text-gray-100">{trip.title_ar}</h3>
                      <Badge variant="default">
                        <Users className="w-3.5 h-3.5" />
                        {trip.booking_count} {t("admin.bookedCount")}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-400 dark:text-gray-500 mt-0.5">{trip.trip_date}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/admin/trips/${trip.id}`)}
                  >
                    <Eye className="w-4 h-4" />
                    {t("admin.manage")}
                  </Button>
                  <Button
                    variant={trip.is_open ? "ghost" : "secondary"}
                    size="sm"
                    onClick={() => toggleOpen(trip)}
                  >
                    {trip.is_open ? (
                      <><Unlock className="w-4 h-4" /> {t("admin.isOpen")}</>
                    ) : (
                      <><Lock className="w-4 h-4" /> {t("admin.isClosed")}</>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => startEdit(trip)}
                  >
                    <Edit className="w-4 h-4" />
                    {t("common.edit")}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(trip.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                    {t("common.delete")}
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
