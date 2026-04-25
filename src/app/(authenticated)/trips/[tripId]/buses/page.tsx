"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useToast } from "@/components/Toast";
import LoadingSpinner from "@/components/LoadingSpinner";
import { bookTripOnly, toggleInSet } from "@/lib/booking";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Bus, Car, Users, Check, X, ChevronDown, ChevronUp, ArrowRight, MapPin, Clock, UserCheck } from "lucide-react";
import type { Bus as BusType, Trip, FamilyMember, PassengerInfo as PassengerInfoType } from "@/lib/types/database";

type PassengerInfo = PassengerInfoType;

type BusWithCount = BusType & { booking_count: number; passengers: PassengerInfo[] };

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
  totalBooked: number;
};

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
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
  const [userHasCar, setUserHasCar] = useState(false);
  const [bookingCar, setBookingCar] = useState(false);

  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [selectedFamilyIds, setSelectedFamilyIds] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    try {
      const [tripRes, busesRes, passengersRes, { data: { user } }] = await Promise.all([
        supabase.from("trips").select("*").eq("id", tripId).single(),
        supabase.from("buses").select("*").eq("trip_id", tripId),
        supabase.rpc("get_trip_passengers", { p_trip_id: tripId }),
        supabase.auth.getUser(),
      ]);

      if (user) {
        const [profileRes, familyRes] = await Promise.all([
          supabase.from("profiles").select("has_car, role").eq("id", user.id).single(),
          supabase.rpc("get_family_members"),
        ]);

        if (profileRes.data) {
          const p = profileRes.data as { has_car: boolean; role: string };
          setUserHasCar(p.has_car && p.role === "servant");
        }

        setFamilyMembers((familyRes.data || []) as FamilyMember[]);
      }

      if (tripRes.data) setTrip(tripRes.data);

      type PassengerRow = {
        bus_id: string;
        full_name: string;
        has_wheelchair: boolean;
        sector_name: string;
        family_member_id: string | null;
        head_user_id: string;
      };
      const passengersByBus: Record<string, PassengerInfo[]> = {};
      for (const p of (passengersRes.data || []) as PassengerRow[]) {
        const list = passengersByBus[p.bus_id] || [];
        list.push({
          full_name: p.full_name,
          has_wheelchair: p.has_wheelchair,
          sector_name: p.sector_name || "",
          family_member_id: p.family_member_id,
          head_user_id: p.head_user_id,
        });
        passengersByBus[p.bus_id] = list;
      }

      const busesWithCounts: BusWithCount[] = (busesRes.data || []).map((bus: BusType) => ({
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
    } catch {
      showToast(t("common.error"), "error");
    } finally {
      setLoading(false);
    }
  }, [tripId, lang, supabase, showToast, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function toggleExpand(busId: string) {
    setExpandedBuses((prev) => {
      const next = new Set(prev);
      if (next.has(busId)) next.delete(busId);
      else next.add(busId);
      return next;
    });
  }

  function toggleFamilyMember(id: string) {
    setSelectedFamilyIds(toggleInSet(selectedFamilyIds, id));
  }

  async function handleBook(bus: BusWithCount) {
    const displayName = bus.bus_label || (lang === "ar" ? bus.area_name_ar : bus.area_name_en);
    const totalPeople = 1 + selectedFamilyIds.size;
    const msg = selectedFamilyIds.size > 0
      ? `${t("buses.choose")}: ${displayName}? (${totalPeople})`
      : `${t("buses.choose")}: ${displayName}?`;
    if (!confirm(msg)) return;

    setBookingBusId(bus.id);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const memberIds = Array.from(selectedFamilyIds);
    const { error } = await supabase.rpc("book_bus_with_family", {
      p_user_id: user.id,
      p_trip_id: tripId,
      p_bus_id: bus.id,
      p_family_member_ids: memberIds,
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
      totalBooked: totalPeople,
    });
  }

  async function handleBookCar() {
    if (!confirm(`${t("cars.imDriving")}?`)) return;

    setBookingCar(true);
    const { error } = await supabase.rpc("book_with_car", {
      p_trip_id: tripId,
    });

    if (error) {
      if (error.message.includes("Already booked")) {
        showToast(t("trips.alreadyBooked"), "error");
      } else {
        showToast(t("common.error"), "error");
      }
      setBookingCar(false);
      return;
    }

    setConfirmation({
      tripTitle: trip ? (lang === "ar" ? trip.title_ar : trip.title_en) : "",
      busLabel: t("cars.imDriving"),
      leaderName: "-",
      tripDate: trip?.trip_date || "",
      totalBooked: 1,
    });
  }

  async function handleBookTripOnly() {
    const totalPeople = 1 + selectedFamilyIds.size;
    const msg = selectedFamilyIds.size > 0
      ? `${t("buses.bookWithoutBus")} (${totalPeople})?`
      : `${t("buses.bookWithoutBus")}?`;
    if (!confirm(msg)) return;

    setBookingBusId("trip-only");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      setBookingBusId(null);
      return;
    }

    const { error } = await bookTripOnly(supabase, {
      userId: user.id,
      tripId,
      familyMemberIds: Array.from(selectedFamilyIds),
    });

    if (error) {
      if (error.message.includes("Already booked")) {
        showToast(t("trips.alreadyBooked"), "error");
      } else {
        showToast(t("common.error"), "error");
      }
      setBookingBusId(null);
      return;
    }

    setConfirmation({
      tripTitle: trip ? (lang === "ar" ? trip.title_ar : trip.title_en) : "",
      busLabel: t("buses.bookWithoutBus"),
      leaderName: "-",
      tripDate: trip?.trip_date || "",
      totalBooked: totalPeople,
    });
  }

  function renderPassengerName(p: PassengerInfo, i: number, all: PassengerInfo[]) {
    const isFamily = !!p.family_member_id;
    const headName = all.find((a) => a.head_user_id === p.head_user_id && !a.family_member_id)?.full_name;
    return (
      <div key={i} className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors",
        isFamily
          ? "bg-purple-50/80 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400"
          : "bg-slate-50 text-slate-700 dark:bg-gray-800 dark:text-gray-300"
      )}>
        {isFamily && <span className="text-xs opacity-60">↳</span>}
        <Avatar className="h-6 w-6">
          <AvatarFallback className="text-[10px] bg-white dark:bg-gray-900">
            {getInitials(p.full_name)}
          </AvatarFallback>
        </Avatar>
        <span>{p.full_name}{p.has_wheelchair && " ♿"}</span>
        {p.sector_name && <span className="text-xs opacity-60">({p.sector_name})</span>}
        {isFamily && headName && (
          <span className="text-xs text-slate-400 dark:text-gray-500">({headName})</span>
        )}
      </div>
    );
  }

  if (loading) {
    return <LoadingSpinner text={t("common.loading")} />;
  }

  if (confirmation) {
    return (
      <div className="max-w-md mx-auto text-center py-8 animate-slide-up">
        <div className="w-24 h-24 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-200/50 dark:shadow-emerald-900/20">
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-900/50 dark:to-emerald-800/40 rounded-full flex items-center justify-center">
            <Check className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mb-6">{t("confirm.title")}</h1>
        <Card className="text-start shadow-lg">
          <CardContent className="p-5 sm:p-6 space-y-1">
            {[
              { label: t("confirm.trip"), value: confirmation.tripTitle },
              { label: t("confirm.bus"), value: confirmation.busLabel },
              { label: t("confirm.leader"), value: confirmation.leaderName },
              { label: t("confirm.date"), value: confirmation.tripDate },
            ].map((item) => (
              <div key={item.label} className="flex justify-between items-center py-3 border-b border-slate-50 dark:border-gray-800 last:border-0">
                <span className="text-slate-400 dark:text-gray-500 text-sm">{item.label}</span>
                <span className="font-semibold text-slate-800 dark:text-gray-100">{item.value}</span>
              </div>
            ))}
            {confirmation.totalBooked > 1 && (
              <div className="flex justify-between items-center py-3 border-b border-slate-50 dark:border-gray-800 last:border-0">
                <span className="text-slate-400 dark:text-gray-500 text-sm">{t("family.bookWith")}</span>
                <Badge variant="purple">{confirmation.totalBooked}</Badge>
              </div>
            )}
          </CardContent>
        </Card>
        <Button
          onClick={() => router.push("/trips")}
          className="w-full mt-6"
          size="lg"
        >
          {t("confirm.ok")}
        </Button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <Button
        variant="ghost"
        onClick={() => router.push("/trips")}
        className="mb-4 gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 -ms-3"
        size="sm"
      >
        <ArrowRight className="w-5 h-5 rtl:rotate-180" />
        {t("buses.back")}
      </Button>

      <h1 className="section-title mb-2">{t("buses.chooseBus")}</h1>
      {trip && (
        <div className="flex items-center gap-2 text-slate-400 dark:text-gray-500 mb-6 text-sm">
          <MapPin className="w-4 h-4" />
          <span>{lang === "ar" ? trip.title_ar : trip.title_en} — {t("trips.date")}: {trip.trip_date}</span>
        </div>
      )}

      {familyMembers.length > 0 && (
        <Card className="mb-6 border-2 border-purple-200 dark:border-purple-800/60 overflow-hidden shadow-sm">
          <CardHeader className="bg-gradient-to-l from-purple-50/60 to-purple-50/20 dark:from-purple-950/20 dark:to-transparent pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-500" />
              {t("family.selectMembers")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled
                className="border-blue-300 bg-blue-50/80 text-blue-700 dark:border-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
              >
                {t("family.me")}
              </Button>
              {familyMembers.map((fm) => (
                <Button
                  key={fm.id}
                  variant="outline"
                  size="sm"
                  onClick={() => toggleFamilyMember(fm.id)}
                  className={cn(
                    "transition-all duration-200 active:scale-95",
                    selectedFamilyIds.has(fm.id)
                      ? "border-purple-400 bg-purple-50 text-purple-700 dark:border-purple-500 dark:bg-purple-950/50 dark:text-purple-400 shadow-sm"
                      : "hover:bg-slate-50 dark:hover:bg-gray-800"
                  )}
                >
                  {fm.full_name}
                  {fm.has_wheelchair && " ♿"}
                  <span className={cn(
                    "text-xs",
                    fm.gender === "Male" ? "text-blue-500" : "text-pink-500"
                  )}>
                    {fm.gender === "Male" ? "♂" : "♀"}
                  </span>
                </Button>
              ))}
            </div>
            {selectedFamilyIds.size > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <Badge variant="purple">
                  {t("family.bookWith")}: 1 + {selectedFamilyIds.size} = {1 + selectedFamilyIds.size}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="mb-6 border-2 border-emerald-200 dark:border-emerald-800/60 overflow-hidden shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 sm:p-6 bg-gradient-to-l from-emerald-50/40 to-transparent dark:from-emerald-950/10 dark:to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-900/40 dark:to-emerald-800/30 flex items-center justify-center shadow-sm">
              <UserCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-gray-100">{t("buses.bookWithoutBus")}</h3>
              <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">{t("buses.bookWithoutBusDesc")}</p>
            </div>
          </div>
          <Button
            variant="default"
            onClick={handleBookTripOnly}
            disabled={bookingBusId !== null}
          >
            {bookingBusId === "trip-only" ? t("common.loading") : t("trips.bookTrip")}
          </Button>
        </div>
      </Card>

      {userHasCar && (
        <Card className="mb-6 border-2 border-blue-200 dark:border-blue-800/60 overflow-hidden shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 sm:p-6 bg-gradient-to-l from-blue-50/40 to-transparent dark:from-blue-950/10 dark:to-transparent">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/40 dark:to-blue-800/30 flex items-center justify-center shadow-sm">
                <Car className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-gray-100">{t("cars.imDriving")}</h3>
                <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">{t("cars.register")}</p>
              </div>
            </div>
            <Button
              variant="default"
              onClick={handleBookCar}
              disabled={bookingCar}
            >
              {bookingCar ? t("common.loading") : t("cars.imDriving")}
            </Button>
          </div>
        </Card>
      )}

      {areaGroups.length === 0 && !userHasCar ? (
        <div className="text-center py-16">
          <div className="w-20 h-20 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-800 dark:to-gray-900 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Clock className="w-10 h-10 text-slate-300 dark:text-gray-600" />
          </div>
          <p className="text-lg text-slate-400 dark:text-gray-500">{t("admin.bookingSoon")}</p>
        </div>
      ) : areaGroups.length === 0 ? null : (
        <div className="space-y-8">
          {areaGroups.map((group) => (
            <div key={group.areaId || group.areaName}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/40 dark:to-blue-800/30 flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="text-lg font-bold text-blue-700 dark:text-blue-400">{group.areaName}</h2>
              </div>
              <div className="space-y-4">
                {group.buses.map((bus) => {
                  const available = bus.capacity - bus.booking_count;
                  const totalNeeded = 1 + selectedFamilyIds.size;
                  const isFull = available < totalNeeded;
                  const percent = Math.min((bus.booking_count / bus.capacity) * 100, 100);
                  const displayName = bus.bus_label || group.areaName;
                  const showAll = expandedBuses.has(bus.id);
                  const visiblePassengers = showAll ? bus.passengers : bus.passengers.slice(0, 5);
                  const hiddenCount = bus.passengers.length - 5;
                  const fillGradient = isFull
                    ? "bg-gradient-to-l from-red-400 to-red-500 dark:from-red-500 dark:to-red-600"
                    : percent > 80
                      ? "bg-gradient-to-l from-amber-400 to-amber-500 dark:from-amber-500 dark:to-amber-600"
                      : "bg-gradient-to-l from-blue-400 to-blue-600 dark:from-blue-500 dark:to-blue-600";

                  return (
                    <Card key={bus.id} className={cn(
                      "overflow-hidden hover:shadow-md transition-all duration-300",
                      isFull && available <= 0 && "opacity-60"
                    )}>
                      <CardHeader className="pb-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center shadow-sm",
                              available <= 0
                                ? "bg-gradient-to-br from-red-100 to-red-200 dark:from-red-900/40 dark:to-red-800/30"
                                : "bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/40 dark:to-blue-800/30"
                            )}>
                              <Bus className={cn(
                                "w-5 h-5",
                                available <= 0
                                  ? "text-red-500 dark:text-red-400"
                                  : "text-blue-600 dark:text-blue-400"
                              )} />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{displayName}</CardTitle>
                              {bus.leader_name && (
                                <p className="text-slate-400 dark:text-gray-500 mt-0.5 text-sm">
                                  {t("buses.leader")}: {bus.leader_name}
                                </p>
                              )}
                            </div>
                          </div>

                          {available <= 0 ? (
                            <Badge variant="destructive" className="shrink-0 self-start sm:self-auto">
                              <X className="w-3.5 h-3.5" />
                              {t("buses.full")}
                            </Badge>
                          ) : (
                            <Button
                              variant="default"
                              onClick={() => handleBook(bus)}
                              disabled={bookingBusId !== null}
                              className="shrink-0 self-start sm:self-auto gap-2"
                            >
                              <Check className="w-5 h-5" />
                              {bookingBusId === bus.id ? t("common.loading") : t("buses.choose")}
                            </Button>
                          )}
                        </div>
                      </CardHeader>

                      <CardContent className="pt-0">
                        <div className="mt-3">
                          <div className="flex justify-between items-center text-sm mb-2">
                            <span className="text-slate-400 dark:text-gray-500 flex items-center gap-1.5">
                              {t("buses.availableSeats")}: <Badge variant={isFull ? "destructive" : "secondary"} className="text-xs">{available}</Badge>
                            </span>
                            <Badge variant="outline" className="text-xs">{bus.booking_count}/{bus.capacity}</Badge>
                          </div>
                          <div className="h-2.5 rounded-full bg-slate-100 dark:bg-gray-800 overflow-hidden" role="progressbar" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}>
                            <div
                              className={cn("h-full rounded-full transition-all duration-500 ease-out", fillGradient)}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>

                        {bus.passengers.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-gray-800">
                            <p className="text-xs font-medium text-slate-300 dark:text-gray-600 mb-2 flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5" />
                              {t("admin.passengersList")} ({bus.passengers.length})
                            </p>
                            <div className="flex flex-wrap gap-1.5 items-center">
                              {visiblePassengers.map((p, i) => renderPassengerName(p, i, visiblePassengers))}
                              {!showAll && hiddenCount > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleExpand(bus.id)}
                                  className="text-blue-600 dark:text-blue-400 gap-1"
                                >
                                  <ChevronDown className="w-4 h-4" />
                                  +{hiddenCount} {t("admin.showMore")}
                                </Button>
                              )}
                            </div>
                            {showAll && bus.passengers.length > 5 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleExpand(bus.id)}
                                className="text-blue-600 dark:text-blue-400 gap-1 mt-1"
                              >
                                <ChevronUp className="w-4 h-4" />
                                {t("admin.showLess")}
                              </Button>
                            )}
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
    </div>
  );
}
