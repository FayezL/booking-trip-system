"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useToast } from "@/components/Toast";
import LoadingSpinner from "@/components/LoadingSpinner";
import {
  generateBusReportPDF,
  generateRoomReportPDF,
} from "@/lib/pdf/generate-report";
import type { Trip, Bus, Room } from "@/lib/types/database";

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

      if (type === "bus") {
        const { data: buses } = await supabase
          .from("buses")
          .select("*")
          .eq("trip_id", selectedTrip);

        const getPassengers = async (busId: string) => {
          const { data: bookings } = await supabase
            .from("bookings")
            .select("user_id")
            .eq("bus_id", busId)
            .is("cancelled_at", null);

          const userIds = (bookings || []).map((b) => b.user_id);
          if (userIds.length === 0) return [];

          const { data: passengers } = await supabase
            .from("profiles")
            .select("full_name, phone, gender")
            .in("id", userIds);

          return passengers || [];
        };

        const pdfBytes = await generateBusReportPDF(
          trip,
          (buses || []) as Bus[],
          getPassengers
        );

        downloadPDF(pdfBytes, "bus-report.pdf");
        showToast(t("admin.busReport"), "success");
      } else {
        const { data: rooms } = await supabase
          .from("rooms")
          .select("*")
          .eq("trip_id", selectedTrip);

        const getOccupants = async (roomId: string) => {
          const { data: bookings } = await supabase
            .from("bookings")
            .select("user_id")
            .eq("room_id", roomId)
            .is("cancelled_at", null);

          const userIds = (bookings || []).map((b) => b.user_id);
          if (userIds.length === 0) return [];

          const { data: occupants } = await supabase
            .from("profiles")
            .select("full_name, phone, gender")
            .in("id", userIds);

          return occupants || [];
        };

        const pdfBytes = await generateRoomReportPDF(
          trip,
          (rooms || []) as Room[],
          getOccupants
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
    return <LoadingSpinner />;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t("admin.reports")}</h1>

      <div className="card mb-6">
        <div className="grid gap-4 md:grid-cols-3">
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
          <div className="flex items-end gap-2">
            <button
              onClick={() => generateReport("bus")}
              disabled={generating}
              className="btn-primary"
            >
              {generating ? <LoadingSpinner /> : t("admin.busReport")}
            </button>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => generateReport("room")}
              disabled={generating}
              className="btn-primary"
            >
              {generating ? <LoadingSpinner /> : t("admin.roomReport")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
