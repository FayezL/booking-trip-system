"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useToast } from "@/components/Toast";
import LoadingSpinner from "@/components/LoadingSpinner";
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
        setGenerating(false);
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
    }

    setGenerating(false);
  }

  function downloadPDF(bytes: Uint8Array, filename: string) {
    const blob = new Blob([new Uint8Array(bytes) as BlobPart], { type: "application/pdf" });
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
    return <LoadingSpinner text={t("common.loading")} />;
  }

  return (
    <div className="animate-fade-in">
      <h1 className="section-title mb-6">{t("admin.reports")}</h1>

      <div className="card">
        <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
          <div>
            <label className="label-text">{t("admin.selectTrip")}</label>
            <select
              className="input-field"
              value={selectedTrip}
              onChange={(e) => setSelectedTrip(e.target.value)}
            >
              <option value="">---</option>
              {trips.map((trip) => (
                <option key={trip.id} value={trip.id}>
                  {trip.title_ar}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => generateReport("bus")}
              disabled={generating}
              className="btn-primary w-full"
            >
              {generating ? <LoadingSpinner /> : t("admin.busReport")}
            </button>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => generateReport("room")}
              disabled={generating}
              className="btn-primary w-full"
            >
              {generating ? <LoadingSpinner /> : t("admin.roomReport")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
