"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { Bus } from "@/lib/types/database";

type BusWithCount = Bus & { booking_count: number; seats_taken: number };

type AreaGroup = {
  areaName: string;
  buses: BusWithCount[];
  totalCapacity: number;
  totalBooked: number;
};

type Tab = "overview" | "buses" | "rooms" | "cars" | "unbooked";

export default function OverviewTab({ tripId, onSwitchTab }: { tripId: string; onSwitchTab: (tab: Tab) => void }) {
  const { t } = useTranslation();
  const supabase = createClient();

  const [totalRegistered, setTotalRegistered] = useState(0);
  const [totalBooked, setTotalBooked] = useState(0);
  const [busSeatsTotal, setBusSeatsTotal] = useState(0);
  const [busSeatsFilled, setBusSeatsFilled] = useState(0);
  const [roomsAssigned, setRoomsAssigned] = useState(0);
  const [roomsTotal, setRoomsTotal] = useState(0);
  const [areaGroups, setAreaGroups] = useState<AreaGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [profilesRes, busesRes, bookingsRes, roomsRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }).is("deleted_at", null),
        supabase.from("buses").select("*").eq("trip_id", tripId),
        supabase.from("bookings").select("bus_id, room_id").eq("trip_id", tripId).is("cancelled_at", null),
        supabase.from("rooms").select("capacity").eq("trip_id", tripId),
      ]);

      const registered = profilesRes.count || 0;
      const allBookings = bookingsRes.data || [];
      const booked = allBookings.length;
      const allBuses = (busesRes.data || []) as Bus[];
      const allRooms = roomsRes.data || [];

      const bookingCounts: Record<string, number> = {};
      for (const b of allBookings) {
        if (b.bus_id) {
          bookingCounts[b.bus_id] = (bookingCounts[b.bus_id] || 0) + 1;
        }
      }

      const busesWithCounts: BusWithCount[] = allBuses.map((bus) => ({
        ...bus,
        booking_count: bookingCounts[bus.id] || 0,
        seats_taken: bookingCounts[bus.id] || 0,
      }));

      const groupMap = new Map<string, AreaGroup>();
      for (const bus of busesWithCounts) {
        const key = bus.area_name_ar;
        const group = groupMap.get(key) || { areaName: key, buses: [], totalCapacity: 0, totalBooked: 0 };
        group.buses.push(bus);
        group.totalCapacity += bus.capacity;
        group.totalBooked += bus.seats_taken;
        groupMap.set(key, group);
      }

      const totalSeats = allBuses.reduce((s, b) => s + b.capacity, 0);
      const totalSeatsTaken = Object.values(bookingCounts).reduce((s, v) => s + v, 0);
      const totalRoomCap = allRooms.reduce((s: number, r: { capacity: number }) => s + r.capacity, 0);
      const assigned = allBookings.filter((b: { room_id: string | null }) => b.room_id !== null).length;

      setTotalRegistered(registered);
      setTotalBooked(booked);
      setBusSeatsTotal(totalSeats);
      setBusSeatsFilled(totalSeatsTaken);
      setRoomsAssigned(assigned);
      setRoomsTotal(totalRoomCap);
      setAreaGroups(Array.from(groupMap.values()));
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [tripId, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return <LoadingSpinner text={t("common.loading")} />;
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-slate-400 dark:text-gray-500 mb-2">{t("common.error")}</p>
        <button onClick={loadData} className="btn-primary">{t("admin.save")}</button>
      </div>
    );
  }

  const stats = [
    { label: t("admin.totalBooked"), value: totalBooked, bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-400" },
    { label: t("admin.unbookedCount"), value: totalRegistered - totalBooked, bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-600 dark:text-red-400" },
    { label: t("admin.busSeatsFilled"), value: `${busSeatsFilled}/${busSeatsTotal}`, bg: "bg-slate-50 dark:bg-gray-800", text: "text-slate-700 dark:text-gray-300" },
    { label: t("admin.roomsAssigned"), value: `${roomsAssigned}/${roomsTotal}`, bg: "bg-purple-50 dark:bg-purple-950/30", text: "text-purple-700 dark:text-purple-400" },
  ];

  function getStatusColor(percent: number) {
    if (percent >= 80) return { fill: "danger", badge: "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400" };
    if (percent >= 50) return { fill: "warning", badge: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400" };
    return { fill: "", badge: "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400" };
  }

  return (
    <div>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-6">
        {stats.map((stat) => (
          <div key={stat.label} className={`${stat.bg} rounded-2xl p-4 text-center`}>
            <div className={`text-2xl font-bold ${stat.text}`}>{stat.value}</div>
            <div className="text-xs text-slate-400 dark:text-gray-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {areaGroups.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-bold text-slate-800 dark:text-gray-100 mb-3">{t("admin.areaOverview")}</h2>
          <div className="space-y-3">
            {areaGroups.map((group) => {
              const percent = group.totalCapacity > 0 ? (group.totalBooked / group.totalCapacity) * 100 : 0;
              const status = getStatusColor(percent);
              return (
                <div key={group.areaName} className="card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-800 dark:text-gray-100">{group.areaName}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.badge}`}>
                        {group.buses.length} {t("admin.busesCount")}
                      </span>
                    </div>
                    <span className="text-sm text-slate-400 dark:text-gray-500">
                      {group.totalBooked}/{group.totalCapacity}
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className={`progress-bar-fill ${status.fill}`}
                      style={{ width: `${Math.min(percent, 100)}%` }}
                    />
                  </div>
                  <p className="text-sm text-slate-400 dark:text-gray-500 mt-2">
                    {group.buses.map((b) => b.bus_label || b.area_name_ar).join("، ")}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {areaGroups.length === 0 && (
        <div className="text-center py-8">
          <p className="text-base text-slate-400 dark:text-gray-500 mb-2">{t("admin.noBusesYet")}</p>
          <p className="text-sm text-slate-300 dark:text-gray-600 mb-4">{t("admin.addBusesFirst")}</p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => onSwitchTab("buses")}
          className="btn-primary w-full sm:w-auto"
        >
          + {t("admin.createBus")}
        </button>
        <button
          onClick={() => onSwitchTab("unbooked")}
          className="btn-secondary w-full sm:w-auto"
        >
          + {t("admin.registerPatient")}
        </button>
      </div>
    </div>
  );
}
