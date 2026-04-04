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
      const [tripsRes, profilesRes, busesRes, roomsRes, bookingsRes, roomBookingsRes] = await Promise.all([
        supabase.from("trips").select("*").order("trip_date", { ascending: false }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("buses").select("trip_id, capacity"),
        supabase.from("rooms").select("trip_id, capacity"),
        supabase.from("bookings").select("trip_id, bus_id").is("cancelled_at", null),
        supabase.from("bookings").select("trip_id, room_id").is("cancelled_at", null).not("room_id", "is", null),
      ]);

      const trips = tripsRes.data || [];
      const totalRegistered = profilesRes.count || 0;

      type BusRow = { trip_id: string; capacity: number };
      type RoomRow = { trip_id: string; capacity: number };
      type BookingRow = { trip_id: string; bus_id?: string; room_id?: string };

      const allBuses = (busesRes.data || []) as BusRow[];
      const allRooms = (roomsRes.data || []) as RoomRow[];
      const allBookings = (bookingsRes.data || []) as BookingRow[];
      const allRoomBookings = (roomBookingsRes.data || []) as BookingRow[];

      function groupBy<T>(arr: T[], key: (item: T) => string): Map<string, T[]> {
        const m = new Map<string, T[]>();
        for (const item of arr) {
          const k = key(item);
          const list = m.get(k) || [];
          list.push(item);
          m.set(k, list);
        }
        return m;
      }

      const busesByTrip = groupBy(allBuses, (b) => b.trip_id);
      const roomsByTrip = groupBy(allRooms, (r) => r.trip_id);
      const bookingsByTrip = groupBy(allBookings, (b) => b.trip_id);
      const roomBookingsByTrip = groupBy(allRoomBookings, (b) => b.trip_id);

      const tripStats: TripStats[] = trips.map((trip: Trip) => {
        const busCap = (busesByTrip.get(trip.id) || []).reduce((s, b) => s + b.capacity, 0);
        const roomCap = (roomsByTrip.get(trip.id) || []).reduce((s, r) => s + r.capacity, 0);
        const booked = (bookingsByTrip.get(trip.id) || []).length;
        const roomsAssigned = (roomBookingsByTrip.get(trip.id) || []).length;

        return {
          trip,
          totalRegistered,
          bookedCount: booked,
          unbookedCount: totalRegistered - booked,
          busSeatsFilled: booked,
          busSeatsTotal: busCap,
          roomsAssigned,
          bookingTotal: roomCap,
        };
      });

      setStats(tripStats);
      setLoading(false);
    }

    loadStats();
  }, []);

  if (loading) {
    return <LoadingSpinner text={t("common.loading")} />;
  }

  return (
    <div className="animate-fade-in">
      <h1 className="section-title mb-6">{t("admin.dashboard")}</h1>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <div
            key={s.trip.id}
            className="card-hover"
            onClick={() => router.push(`/admin/trips/${s.trip.id}`)}
          >
            <h2 className="text-lg font-bold text-slate-800 mb-2">
              {lang === "ar" ? s.trip.title_ar : s.trip.title_en}
            </h2>
            <p className="text-sm text-slate-400 mb-4">{s.trip.trip_date}</p>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <div className="font-bold text-lg text-slate-700">{s.totalRegistered}</div>
                <div className="text-slate-400 text-xs">{t("admin.totalRegistered")}</div>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <div className="font-bold text-lg text-blue-700">{s.bookedCount}</div>
                <div className="text-slate-400 text-xs">{t("admin.bookedCount")}</div>
              </div>
              <div className="bg-red-50 rounded-xl p-3 text-center">
                <div className="font-bold text-lg text-red-600">{s.unbookedCount}</div>
                <div className="text-slate-400 text-xs">{t("admin.unbookedCount")}</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <div className="font-bold text-lg text-slate-700">
                  {s.busSeatsFilled}/{s.busSeatsTotal}
                </div>
                <div className="text-slate-400 text-xs">{t("admin.busSeatsFilled")}</div>
              </div>
              <div className="bg-purple-50 rounded-xl p-3 text-center col-span-2">
                <div className="font-bold text-lg text-purple-700">
                  {s.roomsAssigned}/{s.bookingTotal}
                </div>
                <div className="text-slate-400 text-xs">{t("admin.roomsAssigned")}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
