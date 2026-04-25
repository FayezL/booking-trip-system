"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { Bus } from "@/lib/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Users, Bus as BusIcon, BedDouble, AlertTriangle, UserCheck, Plus, RefreshCw } from "lucide-react";

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
  const supabase = useMemo(() => createClient(), []);

  const [totalRegistered, setTotalRegistered] = useState(0);
  const [totalBooked, setTotalBooked] = useState(0);
  const [busSeatsTotal, setBusSeatsTotal] = useState(0);
  const [busSeatsFilled, setBusSeatsFilled] = useState(0);
  const [roomsAssigned, setRoomsAssigned] = useState(0);
  const [roomsTotal, setRoomsTotal] = useState(0);
  const [noBusCount, setNoBusCount] = useState(0);
  const [areaGroups, setAreaGroups] = useState<AreaGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [profilesRes, busesRes, bookingsRes, roomsRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }).is("deleted_at", null),
        supabase.from("buses").select("*").eq("trip_id", tripId),
        supabase.from("bookings").select("bus_id, room_id, car_id").eq("trip_id", tripId).is("cancelled_at", null),
        supabase.from("rooms").select("capacity").eq("trip_id", tripId),
      ]);

      const registered = profilesRes.count || 0;
      const allBookings = bookingsRes.data || [];
      const noBus = allBookings.filter((b: { bus_id: string | null; car_id: string | null }) => b.bus_id === null && b.car_id === null).length;
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
      setNoBusCount(noBus);
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
        <p className="text-muted-foreground mb-4">{t("common.error")}</p>
        <Button onClick={loadData} variant="outline">
          <RefreshCw className="h-4 w-4 ml-2" />
          {t("common.retry")}
        </Button>
      </div>
    );
  }

  const stats = [
    { label: t("admin.totalBooked"), value: totalBooked, icon: UserCheck, accent: "border-s-blue-500 dark:border-s-blue-400", iconColor: "text-blue-500", bg: "bg-blue-50/50 dark:bg-blue-950/20" },
    { label: t("admin.unbookedCount"), value: totalRegistered - totalBooked, icon: Users, accent: "border-s-red-500 dark:border-s-red-400", iconColor: "text-red-500", bg: "bg-red-50/50 dark:bg-red-950/20" },
    { label: t("admin.busSeatsFilled"), value: `${busSeatsFilled}/${busSeatsTotal}`, icon: BusIcon, accent: "border-s-emerald-500 dark:border-s-emerald-400", iconColor: "text-emerald-500", bg: "bg-emerald-50/50 dark:bg-emerald-950/20" },
    { label: t("admin.roomsAssigned"), value: `${roomsAssigned}/${roomsTotal}`, icon: BedDouble, accent: "border-s-violet-500 dark:border-s-violet-400", iconColor: "text-violet-500", bg: "bg-violet-50/50 dark:bg-violet-950/20" },
    { label: t("admin.noBusAssigned"), value: noBusCount, icon: AlertTriangle, accent: "border-s-amber-500 dark:border-s-amber-400", iconColor: "text-amber-500", bg: "bg-amber-50/50 dark:bg-amber-950/20" },
  ];

  function getStatusColor(percent: number) {
    if (percent >= 80) return { fill: "bg-red-500", badge: "destructive" as const };
    if (percent >= 50) return { fill: "bg-amber-500", badge: "secondary" as const };
    return { fill: "bg-blue-500", badge: "default" as const };
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className={cn("relative overflow-hidden border-s-2", stat.accent, stat.bg)}>
              <CardContent className="p-4 text-center">
                <Icon className={cn("h-6 w-6 mx-auto mb-2", stat.iconColor)} />
                <div className="text-2xl font-bold tracking-tight">{stat.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {areaGroups.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{t("admin.areaOverview")}</h2>
          <div className="space-y-3">
            {areaGroups.map((group) => {
              const percent = group.totalCapacity > 0 ? (group.totalBooked / group.totalCapacity) * 100 : 0;
              const status = getStatusColor(percent);
              return (
                <Card key={group.areaName}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <BusIcon className="h-4 w-4 text-muted-foreground" />
                        <h3 className="text-base font-semibold">{group.areaName}</h3>
                        <Badge variant={status.badge}>
                          {group.buses.length} {t("admin.busesCount")}
                        </Badge>
                      </div>
                      <span className="text-sm text-muted-foreground font-medium">
                        {group.totalBooked}/{group.totalCapacity}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all duration-500", status.fill)}
                        style={{ width: `${Math.min(percent, 100)}%` }}
                      />
                    </div>
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
          <BusIcon className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-base text-muted-foreground mb-1">{t("admin.noBusesYet")}</p>
          <p className="text-sm text-muted-foreground/60">{t("admin.addBusesFirst")}</p>
        </div>
      )}

      <Separator />

      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={() => onSwitchTab("buses")} className="gap-2">
          <Plus className="h-4 w-4" />
          {t("admin.createBus")}
        </Button>
        <Button onClick={() => onSwitchTab("unbooked")} variant="outline" className="gap-2">
          <Plus className="h-4 w-4" />
          {t("admin.registerPatient")}
        </Button>
      </div>
    </div>
  );
}
