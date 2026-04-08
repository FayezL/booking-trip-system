"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useToast } from "@/components/Toast";
import { logAction } from "@/lib/admin-logs";
import PageBreadcrumbs from "@/components/PageBreadcrumbs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, ExternalLink, ToggleLeft } from "lucide-react";
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
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadTrips();
  }, []);

  async function loadTrips() {
    const [tripsRes, bookingsRes] = await Promise.all([
      supabase.from("trips").select("*").order("trip_date", { ascending: false }),
      supabase.from("bookings").select("trip_id").is("cancelled_at", null),
    ]);
    if (tripsRes.error) {
      console.error("[admin/trips] Failed to load trips:", tripsRes.error.message);
    }

    const countMap: Record<string, number> = {};
    for (const b of bookingsRes.data || []) {
      countMap[b.trip_id] = (countMap[b.trip_id] || 0) + 1;
    }

    const tripsWithCounts = (tripsRes.data || []).map((trip: Trip) => ({
      ...trip,
      booking_count: countMap[trip.id] || 0,
    }));
    setTrips(tripsWithCounts);
    setLoading(false);
  }

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
    setDeleteId(null);
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
    return (
      <div className="animate-fade-in">
        <PageBreadcrumbs
          items={[
            { label: t("admin.dashboard"), href: "/admin" },
            { label: t("admin.trips") },
          ]}
        />
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageBreadcrumbs
        items={[
          { label: t("admin.dashboard"), href: "/admin" },
          { label: t("admin.trips") },
        ]}
      />

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t("admin.trips")}</h1>
        <Button onClick={startCreate}>
          <Plus /> {t("admin.createTrip")}
        </Button>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? t("admin.editTrip") : t("admin.createTrip")}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div>
              <Label className="mb-1.5">{t("admin.tripTitle")}</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <Label className="mb-1.5">{t("admin.tripDate")}</Label>
              <Input
                type="date"
                value={form.trip_date}
                onChange={(e) => setForm({ ...form, trip_date: e.target.value })}
                dir="ltr"
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.is_open}
                onCheckedChange={(checked: boolean) =>
                  setForm({ ...form, is_open: checked })
                }
              />
              <Label>
                {form.is_open ? t("admin.isOpen") : t("admin.isClosed")}
              </Label>
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
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
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
                if (deleteId) handleDelete(deleteId);
              }}
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-3">
        {trips.map((trip) => (
          <Card key={trip.id}>
            <CardContent>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-gray-100">
                    {trip.title_ar}
                  </h3>
                  <p className="text-sm text-slate-400 dark:text-gray-500">
                    {trip.trip_date}
                  </p>
                  <Badge variant="secondary" className="mt-1">
                    {trip.booking_count} {t("admin.bookedCount")}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/admin/trips/${trip.id}`)}
                  >
                    <ExternalLink /> {t("admin.manage")}
                  </Button>
                  <Button
                    variant={trip.is_open ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => toggleOpen(trip)}
                  >
                    <ToggleLeft />{" "}
                    {trip.is_open ? t("admin.isOpen") : t("admin.isClosed")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => startEdit(trip)}
                  >
                    <Pencil /> {t("common.edit")}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteId(trip.id)}
                  >
                    <Trash2 /> {t("common.delete")}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
