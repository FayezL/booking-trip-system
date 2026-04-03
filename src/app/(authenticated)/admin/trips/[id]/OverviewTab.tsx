"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { Bus } from "@/lib/types/database";

type BusWithCount = Bus & { booking_count: number };

type AreaGroup = {
  areaName: string;
  buses: BusWithCount[];
  totalCapacity: number;
  totalBooked: number;
};

type Tab = "overview" | "buses" | "rooms" | "unbooked";

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

  useEffect(() => {
    loadData();
  }, [tripId]);

  async function loadData() {
    const [profilesRes, busesRes, bookingsRes, roomsRes] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
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
      if (b.bus_id) bookingCounts[b.bus_id] = (bookingCounts[b.bus_id] || 0) + 1;
    }

    const busesWithCounts: BusWithCount[] = allBuses.map((bus) => ({
      ...bus,
      booking_count: bookingCounts[bus.id] || 0,
    }));

    const groupMap = new Map<string, AreaGroup>();
    for (const bus of busesWithCounts) {
      const key = bus.area_name_ar;
      const group = groupMap.get(key) || { areaName: key, buses: [], totalCapacity: 0, totalBooked: 0 };
      group.buses.push(bus);
      group.totalCapacity += bus.capacity;
      group.totalBooked += bus.booking_count;
      groupMap.set(key, group);
    }

    const totalSeats = allBuses.reduce((s, b) => s + b.capacity, 0);
    const totalRoomCap = allRooms.reduce((s: number, r: { capacity: number }) => s + r.capacity, 0);
    const assigned = allBookings.filter((b: { room_id: string | null }) => b.room_id !== null).length;

    setTotalRegistered(registered);
    setTotalBooked(booked);
    setBusSeatsTotal(totalSeats);
    setBusSeatsFilled(booked);
    setRoomsAssigned(assigned);
    setRoomsTotal(totalRoomCap);
    setAreaGroups(Array.from(groupMap.values()));
    setLoading(false);
  }

  if (loading) {
    return <LoadingSpinner text={t("common.loading")} />;
  }

  const stats = [
    { label: t("admin.totalBooked"), value: totalBooked, bg: "bg-emerald-50", text: "text-emerald-700" },
    { label: t("admin.unbookedCount"), value: totalRegistered - totalBooked, bg: "bg-red-50", text: "text-red-700" },
    { label: t("admin.busSeatsFilled"), value: `${busSeatsFilled}/${busSeatsTotal}`, bg: "bg-blue-50", text: "text-blue-700" },
    { label: t("admin.roomsAssigned"), value: `${roomsAssigned}/${roomsTotal}`, bg: "bg-purple-50", text: "text-purple-700" },
  ];

  function getStatusColor(percent: number) {
    if (percent >= 80) return { bar: "bg-red-500", badge: "bg-red-100 text-red-700" };
    if (percent >= 50) return { bar: "bg-yellow-500", badge: "bg-yellow-100 text-yellow-700" };
    return { bar: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700" };
  }

  return (
    <div>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
        {stats.map((stat) => (
          <div key={stat.label} className={`${stat.bg} rounded-xl p-4 text-center`}>
            <div className={`text-2xl font-bold ${stat.text}`}>{stat.value}</div>
            <div className="text-sm text-gray-600 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {areaGroups.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-3">{t("admin.areaOverview")}</h2>
          <div className="space-y-4">
            {areaGroups.map((group) => {
              const percent = group.totalCapacity > 0 ? (group.totalBooked / group.totalCapacity) * 100 : 0;
              const status = getStatusColor(percent);
              return (
                <div key={group.areaName} className="card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold">{group.areaName}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${status.badge}`}>
                        {group.buses.length} {t("admin.busesCount")}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {group.totalBooked}/{group.totalCapacity}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                    <div
                      className={`h-2 rounded-full transition-all ${status.bar}`}
                      style={{ width: `${Math.min(percent, 100)}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-500">
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
          <p className="text-lg text-gray-500 mb-2">{t("admin.noBusesYet")}</p>
          <p className="text-sm text-gray-400 mb-4">{t("admin.addBusesFirst")}</p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => onSwitchTab("buses")}
          className="btn-primary"
        >
          + {t("admin.createBus")}
        </button>
        <button
          onClick={() => onSwitchTab("unbooked")}
          className="btn-secondary"
        >
          + {t("admin.registerPatient")}
        </button>
      </div>
    </div>
  );
}
