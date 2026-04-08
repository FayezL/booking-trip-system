"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Progress,
} from "@/components/ui/progress";
import { Users, UserX, Bus as BusIcon, BedDouble, Plus, UserPlus } from "lucide-react";
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  async function loadData() {
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
    { label: t("admin.totalBooked"), value: String(totalBooked), icon: Users, bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-400" },
    { label: t("admin.unbookedCount"), value: String(totalRegistered - totalBooked), icon: UserX, bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-600 dark:text-red-400" },
            { label: t("admin.busSeatsFilled"), value: `${busSeatsFilled}/${busSeatsTotal}`, icon: BusIcon, bg: "bg-slate-50 dark:bg-gray-800", text: "text-slate-700 dark:text-gray-300" },
    { label: t("admin.roomsAssigned"), value: `${roomsAssigned}/${roomsTotal}`, icon: BedDouble, bg: "bg-purple-50 dark:bg-purple-950/30", text: "text-purple-700 dark:text-purple-400" },
  ];

  function getProgressClassName(percent: number) {
    if (percent >= 80) return "[&_[data-slot=progress-indicator]]:bg-destructive";
    if (percent >= 50) return "[&_[data-slot=progress-indicator]]:bg-amber-500";
    return "";
  }

  function getStatusBadge(percent: number) {
    if (percent >= 80) return "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400";
    if (percent >= 50) return "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400";
    return "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400";
  }

  return (
    <div>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="border-0">
              <CardContent className="text-center">
                <div className={`inline-flex items-center justify-center rounded-lg p-2 mb-2 ${stat.bg}`}>
                  <Icon className={`size-5 ${stat.text}`} />
                </div>
                <div className={`text-2xl font-bold ${stat.text}`}>{stat.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {areaGroups.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-bold mb-3">{t("admin.areaOverview")}</h2>
          <div className="space-y-3">
            {areaGroups.map((group) => {
              const percent = group.totalCapacity > 0 ? (group.totalBooked / group.totalCapacity) * 100 : 0;
              return (
                <Card key={group.areaName}>
                  <CardContent>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold">
                          {group.areaName}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusBadge(percent)}`}>
                          {group.buses.length} {t("admin.busesCount")}
                        </span>
                      </div>
                      <span className="text-sm text-muted-foreground ms-auto tabular-nums">
                        {group.totalBooked}/{group.totalCapacity}
                      </span>
                    </div>
                    <Progress value={Math.min(percent, 100)} className={getProgressClassName(percent)} />
                    <p className="text-sm text-muted-foreground mt-2">
                      {group.buses.map((b) => b.bus_label || b.area_name_ar).join("، ")}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {areaGroups.length === 0 && (
        <div className="text-center py-8">
          <p className="text-base text-muted-foreground mb-2">{t("admin.noBusesYet")}</p>
          <p className="text-sm text-muted-foreground/60 mb-4">{t("admin.addBusesFirst")}</p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={() => onSwitchTab("buses")} className="w-full sm:w-auto">
          <Plus /> {t("admin.createBus")}
        </Button>
        <Button variant="outline" onClick={() => onSwitchTab("unbooked")} className="w-full sm:w-auto">
          <UserPlus /> {t("admin.registerPatient")}
        </Button>
      </div>
    </div>
  );
}
