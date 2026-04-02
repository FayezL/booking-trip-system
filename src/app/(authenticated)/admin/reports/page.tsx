"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useToast } from "@/components/Toast";
import type { Trip } from "@/lib/types/database";

export default function ReportsPage() {
  const { t, lang } = useTranslation();
  const supabase = createClient();
  const { showToast } = useToast();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<string>("");
  const [reportData, setReportData] = useState<string>("");
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

      let report = `=== ${t("admin.busReport")} ===\n`;
      report += `${lang === "ar" ? trip.title_ar : trip.title_en} — ${trip.trip_date}\n\n`;

      for (const bus of buses || []) {
        const areaName = lang === "ar" ? bus.area_name_ar : bus.area_name_en;
        report += `--- ${areaName} ---\n`;
        report += `${t("admin.leaderName")}: ${bus.leader_name || "-"}\n`;
        report += `${t("admin.capacity")}: ${bus.capacity}\n`;

        const { data: bookings } = await supabase
          .from("bookings")
          .select("user_id")
          .eq("bus_id", bus.id)
          .is("cancelled_at", null);

        const userIds = (bookings || []).map((b) => b.user_id);
        report += `${t("admin.passengers")} (${userIds.length}):\n`;

        if (userIds.length > 0) {
          const { data: passengers } = await supabase
            .from("profiles")
            .select("full_name, phone, gender")
            .in("id", userIds);

          for (const p of passengers || []) {
            report += `  - ${p.full_name} (${p.phone}) [${p.gender}]\n`;
          }
        }

        report += "\n";
      }

      setReportData(report);
    } else {
      const { data: rooms } = await supabase
        .from("rooms")
        .select("*")
        .eq("trip_id", selectedTrip);

      let report = `=== ${t("admin.roomReport")} ===\n`;
      report += `${lang === "ar" ? trip.title_ar : trip.title_en} — ${trip.trip_date}\n\n`;

      for (const room of rooms || []) {
        report += `--- ${room.room_label} (${room.room_type}) ---\n`;
        report += `${t("admin.supervisorName")}: ${room.supervisor_name || "-"}\n`;
        report += `${t("admin.capacity")}: ${room.capacity}\n`;

        const { data: bookings } = await supabase
          .from("bookings")
          .select("user_id")
          .eq("room_id", room.id)
          .is("cancelled_at", null);

        const userIds = (bookings || []).map((b) => b.user_id);
        report += `${t("admin.occupants")} (${userIds.length}):\n`;

        if (userIds.length > 0) {
          const { data: occupants } = await supabase
            .from("profiles")
            .select("full_name, phone, gender")
            .in("id", userIds);

          for (const o of occupants || []) {
            report += `  - ${o.full_name} (${o.phone}) [${o.gender}]\n`;
          }
        }

        report += "\n";
      }

      setReportData(report);
    }

    setGenerating(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-xl text-gray-500">{t("common.loading")}</p>
      </div>
    );
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
              onChange={(e) => {
                setSelectedTrip(e.target.value);
                setReportData("");
              }}
            >
              <option value="">---</option>
              {trips.map((trip) => (
                <option key={trip.id} value={trip.id}>
                  {lang === "ar" ? trip.title_ar : trip.title_en}
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
              {generating ? t("common.loading") : t("admin.busReport")}
            </button>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => generateReport("room")}
              disabled={generating}
              className="btn-primary"
            >
              {generating ? t("common.loading") : t("admin.roomReport")}
            </button>
          </div>
        </div>
      </div>

      {reportData && (
        <div className="card">
          <pre
            className="whitespace-pre-wrap text-sm leading-relaxed font-mono"
            dir="rtl"
          >
            {reportData}
          </pre>
        </div>
      )}
    </div>
  );
}
