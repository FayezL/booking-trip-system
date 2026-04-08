"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useToast } from "@/components/Toast";
import type { Bus, Trip } from "@/lib/types/database";
import PageBreadcrumbs from "@/components/PageBreadcrumbs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ArrowRight, Users, User, ChevronDown, ChevronUp, CheckCircle } from "lucide-react";

type PassengerInfo = { full_name: string; has_wheelchair: boolean };
type BusWithCount = Bus & { booking_count: number; passengers: PassengerInfo[] };

type AreaGroup = {
  areaId: string | null;
  areaName: string;
  buses: BusWithCount[];
};

type BookingConfirmation = {
  tripTitle: string;
  busLabel: string;
  leaderName: string;
  tripDate: string;
};

function getCapacityColor(percent: number, isFull: boolean): string {
  if (isFull) return "bg-destructive";
  if (percent >= 80) return "bg-amber-500";
  return "";
}

export default function BusesPage({ params }: { params: { tripId: string } }) {
  const { tripId } = params;
  const { t, lang } = useTranslation();
  const router = useRouter();
  const supabase = createClient();
  const { showToast } = useToast();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [areaGroups, setAreaGroups] = useState<AreaGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingBusId, setBookingBusId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);
  const [expandedBuses, setExpandedBuses] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function loadData() {
      const [tripRes, busesRes, passengersRes] = await Promise.all([
        supabase.from("trips").select("*").eq("id", tripId).single(),
        supabase.from("buses").select("*").eq("trip_id", tripId),
        supabase.rpc("get_trip_passengers", { p_trip_id: tripId }),
      ]);

      if (tripRes.data) setTrip(tripRes.data);

      type PassengerRow = { bus_id: string; full_name: string; has_wheelchair: boolean };
      const passengersByBus: Record<string, PassengerInfo[]> = {};
      for (const p of (passengersRes.data || []) as PassengerRow[]) {
        const list = passengersByBus[p.bus_id] || [];
        list.push({ full_name: p.full_name, has_wheelchair: p.has_wheelchair });
        passengersByBus[p.bus_id] = list;
      }

      const busesWithCounts: BusWithCount[] = (busesRes.data || []).map((bus: Bus) => ({
        ...bus,
        booking_count: (passengersByBus[bus.id] || []).length,
        passengers: passengersByBus[bus.id] || [],
      }));

      const groupMap = new Map<string, AreaGroup>();
      for (const bus of busesWithCounts) {
        const key = bus.area_id || bus.area_name_ar;
        const areaName = lang === "ar" ? bus.area_name_ar : bus.area_name_en;
        const group = groupMap.get(key) || { areaId: bus.area_id, areaName, buses: [] };
        group.buses.push(bus);
        groupMap.set(key, group);
      }

      setAreaGroups(Array.from(groupMap.values()));
      setLoading(false);
    }

    loadData();
  }, [tripId, lang]);

  function toggleExpand(busId: string) {
    setExpandedBuses((prev) => {
      const next = new Set(prev);
      if (next.has(busId)) next.delete(busId);
      else next.add(busId);
      return next;
    });
  }

  async function handleBook(bus: BusWithCount) {
    const displayName = bus.bus_label || (lang === "ar" ? bus.area_name_ar : bus.area_name_en);
    const confirmed = confirm(`${t("buses.choose")}: ${displayName}?`);
    if (!confirmed) return;

    setBookingBusId(bus.id);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const { error } = await supabase.rpc("book_bus", {
      p_user_id: user.id,
      p_trip_id: tripId,
      p_bus_id: bus.id,
    });

    if (error) {
      if (error.message.includes("Already booked")) {
        showToast(t("trips.alreadyBooked"), "error");
      } else if (error.message.includes("full") || error.message.includes("Full")) {
        showToast(t("buses.full"), "error");
      } else {
        showToast(t("common.error"), "error");
      }
      setBookingBusId(null);
      return;
    }

    setConfirmation({
      tripTitle: trip ? (lang === "ar" ? trip.title_ar : trip.title_en) : "",
      busLabel: displayName,
      leaderName: bus.leader_name || "-",
      tripDate: trip?.trip_date || "",
    });
  }

  const tripTitle = trip ? (lang === "ar" ? trip.title_ar : trip.title_en) : "";

  if (loading) {
    return (
      <div className="animate-fade-in">
        <PageBreadcrumbs items={[{ label: t("trips.title"), href: "/trips" }, { label: "" }]} />
        <div className="mt-6 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent>
                <div className="space-y-3">
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-2 w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageBreadcrumbs items={[{ label: t("trips.title"), href: "/trips" }, { label: tripTitle }]} />

      <div className="mt-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.push("/trips")}>
          <ArrowRight className="rtl:rotate-180" />
          <span>{t("buses.back")}</span>
        </Button>
      </div>

      <h1 className="text-xl font-bold mb-2">{t("buses.chooseBus")}</h1>
      {trip && (
        <p className="text-muted-foreground mb-6 text-sm">
          {lang === "ar" ? trip.title_ar : trip.title_en} — {t("trips.date")}: {trip.trip_date}
        </p>
      )}

      {areaGroups.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-lg text-muted-foreground">{t("admin.bookingSoon")}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {areaGroups.map((group) => (
            <div key={group.areaId || group.areaName}>
              <h2 className="text-lg font-bold text-primary mb-3">{group.areaName}</h2>
              <div className="space-y-3">
                {group.buses.map((bus) => {
                  const available = bus.capacity - bus.booking_count;
                  const isFull = available <= 0;
                  const percent = Math.min((bus.booking_count / bus.capacity) * 100, 100);
                  const displayName = bus.bus_label || group.areaName;
                  const showAll = expandedBuses.has(bus.id);
                  const visiblePassengers = showAll ? bus.passengers : bus.passengers.slice(0, 5);
                  const hiddenCount = bus.passengers.length - 5;

                  return (
                    <Card key={bus.id} className={isFull ? "opacity-60" : ""}>
                      <CardContent>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                          <div>
                            <h3 className="text-lg font-bold">{displayName}</h3>
                            {bus.leader_name && (
                              <p className="text-muted-foreground mt-0.5 text-sm flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5" />
                                {t("buses.leader")}: {bus.leader_name}
                              </p>
                            )}
                          </div>

                          {isFull ? (
                            <Badge variant="destructive" className="shrink-0 self-start sm:self-auto">
                              {t("buses.full")}
                            </Badge>
                          ) : (
                            <Button
                              variant="default"
                              className="w-full sm:w-auto shrink-0"
                              onClick={() => handleBook(bus)}
                              disabled={bookingBusId !== null}
                            >
                              {bookingBusId === bus.id ? t("common.loading") : t("buses.choose")}
                            </Button>
                          )}
                        </div>

                        <div className="mt-3">
                          <div className="flex justify-between text-sm text-muted-foreground mb-1.5">
                            <span>{t("buses.availableSeats")}: {available}</span>
                            <span>{bus.booking_count}/{bus.capacity}</span>
                          </div>
                          <Progress value={percent}>
                            <ProgressTrack>
                              <ProgressIndicator
                                style={{ width: `${percent}%` }}
                                className={getCapacityColor(percent, isFull)}
                              />
                            </ProgressTrack>
                          </Progress>
                        </div>

                        {bus.passengers.length > 0 && (
                          <div className="mt-3 pt-3">
                            <Separator />
                            <p className="text-xs font-medium text-muted-foreground mt-3 mb-1">
                              {t("admin.passengersList")} ({bus.passengers.length})
                            </p>
                            <div className="text-sm text-muted-foreground">
                              {visiblePassengers.map((p, i) => (
                                <span key={i}>
                                  {p.full_name}{p.has_wheelchair && " ♿"}{i < visiblePassengers.length - 1 ? "، " : ""}
                                </span>
                              ))}
                              {!showAll && hiddenCount > 0 && (
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="ms-1 p-0 h-auto text-sm"
                                  onClick={() => toggleExpand(bus.id)}
                                >
                                  <ChevronDown className="w-3.5 h-3.5" />
                                  +{hiddenCount} {t("admin.showMore")}
                                </Button>
                              )}
                              {showAll && bus.passengers.length > 5 && (
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="ms-1 p-0 h-auto text-sm"
                                  onClick={() => toggleExpand(bus.id)}
                                >
                                  <ChevronUp className="w-3.5 h-3.5" />
                                  {t("admin.showLess")}
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!confirmation} onOpenChange={(open) => { if (!open) setConfirmation(null); }}>
        <DialogContent>
          <DialogHeader className="items-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-2">
              <CheckCircle className="w-8 h-8 text-primary" />
            </div>
            <DialogTitle className="text-xl text-center">{t("confirm.title")}</DialogTitle>
            <DialogDescription className="sr-only">{t("confirm.title")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-0">
            {confirmation && [
              { label: t("confirm.trip"), value: confirmation.tripTitle },
              { label: t("confirm.bus"), value: confirmation.busLabel },
              { label: t("confirm.leader"), value: confirmation.leaderName },
              { label: t("confirm.date"), value: confirmation.tripDate },
            ].map((item, idx, arr) => (
              <div key={item.label}>
                <div className="flex justify-between items-center py-2.5">
                  <span className="text-muted-foreground text-sm">{item.label}</span>
                  <span className="font-semibold text-sm">{item.value}</span>
                </div>
                {idx < arr.length - 1 && <Separator />}
              </div>
            ))}
          </div>
          <Button
            variant="default"
            className="w-full mt-2"
            onClick={() => {
              setConfirmation(null);
              router.push("/trips");
            }}
          >
            {t("confirm.ok")}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
