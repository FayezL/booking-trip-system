"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useToast } from "@/components/Toast";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { Trip, Bus, Room, Car } from "@/lib/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FileDown, FileText } from "lucide-react";
import {
  generateReportHTML,
  type ReportPassenger,
  type ReportData,
} from "@/lib/pdf/generate-report-html";

export default function ReportsPage() {
  const { t } = useTranslation();
  const supabase = createClient();
  const { showToast } = useToast();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const loadTrips = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("trips")
        .select("*")
        .order("trip_date", { ascending: false });
      setTrips(data || []);
    } catch {
      showToast(t("common.error"), "error");
    } finally {
      setLoading(false);
    }
  }, [supabase, showToast, t]);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  async function generateReport() {
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

      const [
        statsRes,
        busesRes,
        roomsRes,
        carsRes,
        bookingsRes,
      ] = await Promise.all([
        supabase.rpc("get_all_trips_stats"),
        supabase.from("buses").select("*").eq("trip_id", selectedTrip),
        supabase.from("rooms").select("*").eq("trip_id", selectedTrip),
        supabase.from("cars").select("*").eq("trip_id", selectedTrip),
        supabase
          .from("bookings")
          .select(`
            id, user_id, bus_id, room_id, car_id, family_member_id,
            profiles!bookings_user_id_fkey (full_name, phone, gender, role, has_wheelchair, sector_id),
            family_members (full_name, gender, has_wheelchair),
            buses (bus_label),
            rooms (room_label),
            cars (car_label)
          `)
          .eq("trip_id", selectedTrip)
          .is("cancelled_at", null),
      ]);

      const bookings = bookingsRes.data || [];
      const buses = (busesRes.data || []) as Bus[];
      const rooms = (roomsRes.data || []) as Room[];
      const cars = (carsRes.data || []) as Car[];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allTripStats = (statsRes.data || []) as any[];
      const stats = allTripStats.length > 0 ? allTripStats[0] : null;

      const sectorIdSet = new Set<string>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      bookings.forEach((b: any) => {
        if (b.profiles?.sector_id) sectorIdSet.add(b.profiles.sector_id);
      });
      const sectorIds = Array.from(sectorIdSet);

      const sectorMap = new Map<string, string>();
      if (sectorIds.length > 0) {
        const { data: sectors } = await supabase
          .from("sectors")
          .select("id, name")
          .in("id", sectorIds);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (sectors || []).forEach((s: any) => sectorMap.set(s.id, s.name));
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const passengers: ReportPassenger[] = bookings.map((b: any) => {
        const isFamily = !!b.family_member_id;
        const fm = b.family_members;
        const profile = b.profiles;
        const busLabel = b.buses?.bus_label || "";
        const roomLabel = b.rooms?.room_label || "";
        const carLabel = b.cars?.car_label || "";

        return {
          full_name: isFamily ? fm?.full_name || "" : profile?.full_name || "",
          phone: isFamily ? "" : profile?.phone || "",
          gender: isFamily ? fm?.gender || "" : profile?.gender || "",
          role: isFamily ? "" : profile?.role || "",
          sector_name: isFamily ? "" : (sectorMap.get(profile?.sector_id) || ""),
          has_wheelchair: isFamily ? fm?.has_wheelchair || false : profile?.has_wheelchair || false,
          family_member_id: b.family_member_id,
          user_id: b.user_id,
          head_user_id: b.user_id,
          bus_id: b.bus_id,
          bus_label: busLabel,
          room_id: b.room_id,
          room_label: roomLabel,
          car_id: b.car_id,
          car_label: carLabel,
        };
      });

      const busPassengers = new Map<string, ReportPassenger[]>();
      buses.forEach((bus) => {
        busPassengers.set(bus.id, passengers.filter((p) => p.bus_id === bus.id));
      });

      const roomOccupants = new Map<string, ReportPassenger[]>();
      rooms.forEach((room) => {
        roomOccupants.set(room.id, passengers.filter((p) => p.room_id === room.id));
      });

      const carPassengers = new Map<string, ReportPassenger[]>();
      cars.forEach((car) => {
        carPassengers.set(car.id, passengers.filter((p) => p.car_id === car.id));
      });

      const reportData: ReportData = {
        trip,
        stats,
        buses,
        rooms,
        cars,
        passengers,
        busPassengers,
        roomOccupants,
        carPassengers,
      };

      const html = generateReportHTML(reportData);
      const newWin = window.open("", "_blank");
      if (newWin) {
        newWin.document.write(html);
        newWin.document.close();
      }
      showToast(t("admin.reportGenerated"), "success");
    } catch (err) {
      console.error("Report generation error:", err);
      showToast(t("common.error"), "error");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return <LoadingSpinner text={t("common.loading")} />;
  }

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center gap-2">
        <FileDown className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        <h1 className="section-title">{t("admin.reports")}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5" />
            {t("admin.generateReport")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t("admin.reportDescription")}
            </p>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("admin.selectTrip")}</Label>
                <Select value={selectedTrip} onValueChange={setSelectedTrip}>
                  <SelectTrigger>
                    <SelectValue placeholder="---" />
                  </SelectTrigger>
                  <SelectContent>
                    {trips.map((trip) => (
                      <SelectItem key={trip.id} value={trip.id}>
                        {trip.title_ar} — {trip.trip_date}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={generateReport}
                  disabled={generating || !selectedTrip}
                  className="w-full gap-2"
                  size="lg"
                >
                  {generating ? (
                    <LoadingSpinner />
                  ) : (
                    <>
                      <FileDown className="h-5 w-5" />
                      {t("admin.generateReport")}
                    </>
                  )}
                </Button>
              </div>
            </div>

            {selectedTrip && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 text-xs text-gray-500 dark:text-gray-400">
                <span>{t("admin.reportIncludes.summary")}</span>
                <span>{t("admin.reportIncludes.buses")}</span>
                <span>{t("admin.reportIncludes.rooms")}</span>
                <span>{t("admin.reportIncludes.cars")}</span>
                <span>{t("admin.reportIncludes.wheelchair")}</span>
                <span>{t("admin.reportIncludes.unassigned")}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
