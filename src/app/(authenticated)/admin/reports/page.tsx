"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useToast } from "@/components/Toast";
import PageBreadcrumbs from "@/components/PageBreadcrumbs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Bus as BusIcon, BedDouble, Download } from "lucide-react";
import type { Trip, Bus, Room } from "@/lib/types/database";

type Passenger = {
  full_name: string;
  phone: string;
  gender: string;
};

export default function ReportsPage() {
  const { t } = useTranslation();
  const supabase = createClient();
  const { showToast } = useToast();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    async function loadTrips() {
      const { data } = await supabase
        .from("trips")
        .select("*")
        .order("trip_date", { ascending: false });
      setTrips(data || []);
      setLoading(false);
    }
    loadTrips();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generateReport(type: "bus" | "room") {
    if (!selectedTrip) {
      showToast(t("admin.selectTrip"), "error");
      return;
    }

    setGenerating(true);

    try {
      const trip = trips.find((tr) => tr.id === selectedTrip);
      if (!trip) {
        showToast(t("admin.selectTrip"), "error");
        return;
      }

      const { generateBusReportPDF, generateRoomReportPDF } = await import("@/lib/pdf/generate-report");

      if (type === "bus") {
        const [busesRes, bookingsRes] = await Promise.all([
          supabase.from("buses").select("*").eq("trip_id", selectedTrip),
          supabase.from("bookings").select("bus_id, user_id, profiles(full_name, phone, gender)").eq("trip_id", selectedTrip).is("cancelled_at", null),
        ]);

        const busMap = new Map<string, Passenger[]>();
        for (const b of bookingsRes.data || []) {
          const list = busMap.get(b.bus_id) || [];
          if (b.profiles) list.push(b.profiles as unknown as Passenger);
          busMap.set(b.bus_id, list);
        }

        const pdfBytes = await generateBusReportPDF(
          trip,
          (busesRes.data || []) as Bus[],
          async (busId) => busMap.get(busId) || []
        );

        downloadPDF(pdfBytes, "bus-report.pdf");
        showToast(t("admin.busReport"), "success");
      } else {
        const [roomsRes, bookingsRes] = await Promise.all([
          supabase.from("rooms").select("*").eq("trip_id", selectedTrip),
          supabase.from("bookings").select("room_id, user_id, profiles(full_name, phone, gender)").eq("trip_id", selectedTrip).is("cancelled_at", null).not("room_id", "is", null),
        ]);

        const roomMap = new Map<string, Passenger[]>();
        for (const b of bookingsRes.data || []) {
          if (!b.room_id) continue;
          const list = roomMap.get(b.room_id) || [];
          if (b.profiles) list.push(b.profiles as unknown as Passenger);
          roomMap.set(b.room_id, list);
        }

        const pdfBytes = await generateRoomReportPDF(
          trip,
          (roomsRes.data || []) as Room[],
          async (roomId) => roomMap.get(roomId) || []
        );

        downloadPDF(pdfBytes, "room-report.pdf");
        showToast(t("admin.roomReport"), "success");
      }
    } catch {
      showToast(t("common.error"), "error");
    } finally {
      setGenerating(false);
    }
  }

  function downloadPDF(bytes: Uint8Array, filename: string) {
    const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="animate-fade-in space-y-6">
        <PageBreadcrumbs
          items={[
            { label: t("admin.dashboard"), href: "/admin" },
            { label: t("admin.reports") },
          ]}
        />
        <div className="flex items-center gap-2">
          <FileText className="size-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold">{t("admin.reports")}</h1>
        </div>
        <Card>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-2/3" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <PageBreadcrumbs
        items={[
          { label: t("admin.dashboard"), href: "/admin" },
          { label: t("admin.reports") },
        ]}
      />

      <div className="flex items-center gap-2">
        <FileText className="size-5 text-muted-foreground" />
        <h1 className="text-xl font-semibold">{t("admin.reports")}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="size-4" />
            {t("admin.reports")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("admin.selectTrip")}</label>
              <Select
                value={selectedTrip || null}
                onValueChange={(val) => setSelectedTrip(val ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="---" />
                </SelectTrigger>
                <SelectContent>
                  {trips.map((trip) => (
                    <SelectItem key={trip.id} value={trip.id}>
                      {trip.title_ar}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                className="w-full"
                onClick={() => generateReport("bus")}
                disabled={generating}
              >
                <BusIcon className="size-4" />
                {generating ? "..." : t("admin.busReport")}
              </Button>
            </div>
            <div className="flex items-end">
              <Button
                className="w-full"
                onClick={() => generateReport("room")}
                disabled={generating}
              >
                <BedDouble className="size-4" />
                {generating ? "..." : t("admin.roomReport")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
