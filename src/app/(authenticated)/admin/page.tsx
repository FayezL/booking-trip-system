"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { Trip } from "@/lib/types/database";

type TripStats = {
  trip: Trip;
  totalRegistered: number;
  bookedCount: number;
  unbookedCount: number;
  busSeatsFilled: number;
  busSeatsTotal: number;
  roomsAssigned: number;
  bookingTotal: number;
};

export default function AdminDashboard() {
  const { t, lang } = useTranslation();
  const router = useRouter();
  const supabase = createClient();

  const [stats, setStats] = useState<TripStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      const { data: trips } = await supabase
        .from("trips")
        .select("*")
        .order("trip_date", { ascending: false });

      if (!trips) {
        setLoading(false);
        return;
      }

      const tripStats: TripStats[] = [];

      for (const trip of trips) {
        const [profilesRes, busesRes, roomsRes] = await Promise.all([
          supabase.from("profiles").select("id", { count: "exact", head: true }),
          supabase.from("buses").select("capacity").eq("trip_id", trip.id),
          supabase.from("rooms").select("capacity").eq("trip_id", trip.id),
        ]);

        const totalRegistered = profilesRes.count || 0;
        const totalBusCapacity = (busesRes.data || []).reduce((sum, b) => sum + b.capacity, 0);
        const totalRoomCapacity = (roomsRes.data || []).reduce((sum, r) => sum + r.capacity, 0);

        const [bookingsRes, roomBookingsRes] = await Promise.all([
          supabase
            .from("bookings")
            .select("bus_id", { count: "exact" })
            .eq("trip_id", trip.id)
            .is("cancelled_at", null),
          supabase
            .from("bookings")
            .select("room_id", { count: "exact" })
            .eq("trip_id", trip.id)
            .is("cancelled_at", null)
            .not("room_id", "is", null),
        ]);

        const busSeatsFilled = bookingsRes.count || 0;
        const roomsAssigned = roomBookingsRes.count || 0;

        tripStats.push({
          trip,
          totalRegistered,
          bookedCount: bookingsRes.count || 0,
          unbookedCount: totalRegistered - (bookingsRes.count || 0),
          busSeatsFilled,
          busSeatsTotal: totalBusCapacity,
          roomsAssigned,
          bookingTotal: totalRoomCapacity,
        });
      }

      setStats(tripStats);
      setLoading(false);
    }

    loadStats();
  }, []);

  if (loading) {
    return <LoadingSpinner text={t("common.loading")} />;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t("admin.dashboard")}</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <div
            key={s.trip.id}
            className="card cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => router.push(`/admin/trips/${s.trip.id}`)}
          >
            <h2 className="text-xl font-bold mb-3">
              {lang === "ar" ? s.trip.title_ar : s.trip.title_en}
            </h2>
            <p className="text-sm text-gray-500 mb-3">{s.trip.trip_date}</p>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-gray-50 rounded-lg p-2 text-center">
                <div className="font-bold text-lg">{s.totalRegistered}</div>
                <div className="text-gray-500">{t("admin.totalRegistered")}</div>
              </div>
              <div className="bg-emerald-50 rounded-lg p-2 text-center">
                <div className="font-bold text-lg text-emerald-700">{s.bookedCount}</div>
                <div className="text-gray-500">{t("admin.bookedCount")}</div>
              </div>
              <div className="bg-red-50 rounded-lg p-2 text-center">
                <div className="font-bold text-lg text-red-700">{s.unbookedCount}</div>
                <div className="text-gray-500">{t("admin.unbookedCount")}</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-2 text-center">
                <div className="font-bold text-lg text-blue-700">
                  {s.busSeatsFilled}/{s.busSeatsTotal}
                </div>
                <div className="text-gray-500">{t("admin.busSeatsFilled")}</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-2 text-center">
                <div className="font-bold text-lg text-purple-700">
                  {s.roomsAssigned}/{s.bookingTotal}
                </div>
                <div className="text-gray-500">{t("admin.roomsAssigned")}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
