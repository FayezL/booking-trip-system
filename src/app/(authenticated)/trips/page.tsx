"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
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
import { ChevronDown, ChevronUp, Bus, MapPin, Users, X, Check, CalendarDays } from "lucide-react";
import type { Trip, Booking, FamilyMember, PassengerInfo } from "@/lib/types/database";

export default function TripsPage() {
  const { t, lang } = useTranslation();
  const router = useRouter();
  const supabase = createClient();
  const { showToast } = useToast();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [myBookings, setMyBookings] = useState<(Booking & { trips: Trip; buses: { area_name_ar: string; area_name_en: string } | null; family_members?: { full_name: string } | null })[]>([]);
  const [passengersByTrip, setPassengersByTrip] = useState<Record<string, PassengerInfo[]>>({});
  const [expandedTrips, setExpandedTrips] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [selectedFamilyByTrip, setSelectedFamilyByTrip] = useState<Record<string, Set<string>>>({});
  const [bookingTripId, setBookingTripId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) return;

      const [tripsRes, bookingsRes, familyRes] = await Promise.all([
        supabase.from("trips").select("*").eq("is_open", true).order("trip_date", { ascending: false }),
        supabase
          .from("bookings")
          .select("*, trips(*), buses(area_name_ar, area_name_en), family_members(full_name)")
          .eq("user_id", user.id)
          .is("cancelled_at", null),
        supabase.rpc("get_family_members"),
      ]);

      const tripsData = tripsRes.data || [];
      setTrips(tripsData);
      setMyBookings((bookingsRes.data || []) as unknown as typeof myBookings);
      setFamilyMembers((familyRes.data || []) as FamilyMember[]);

      if (tripsData.length > 0) {
        const passengerMap: Record<string, PassengerInfo[]> = {};
        await Promise.all(
          tripsData.map(async (trip: Trip) => {
            const { data } = await supabase.rpc("get_trip_passengers", { p_trip_id: trip.id });
            passengerMap[trip.id] = (data || []) as PassengerInfo[];
          })
        );
        setPassengersByTrip(passengerMap);
      }
    } catch (err) {
      console.error("Unexpected error in loadData:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const bookedTripIds = useMemo(() => new Set(myBookings.map((b) => b.trip_id)), [myBookings]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function getTripTitle(trip: Trip): string {
    return lang === "ar" ? trip.title_ar : trip.title_en;
  }

  async function handleCancelBooking(bookingId: string) {
    if (!confirm(t("admin.confirmCancel"))) return;
    setCancellingId(bookingId);
    const { error } = await supabase.rpc("cancel_booking", { p_booking_id: bookingId });
    setCancellingId(null);
    if (error) {
      showToast(t("common.error"), "error");
      return;
    }
    loadData();
  }

  function getSelectedForTrip(tripId: string) {
    return selectedFamilyByTrip[tripId] || new Set<string>();
  }

  function toggleFamilyMember(tripId: string, id: string) {
    const current = getSelectedForTrip(tripId);
    setSelectedFamilyByTrip((prev) => ({ ...prev, [tripId]: toggleInSet(current, id) }));
  }

  function getInitials(name: string) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  async function handleBookTrip(tripId: string) {
    const selected = getSelectedForTrip(tripId);
    const totalPeople = 1 + selected.size;
    const msg = selected.size > 0
      ? `${t("trips.bookTripFor").replace("{count}", String(totalPeople))}?`
      : `${t("trips.bookTrip")}?`;
    if (!confirm(msg)) return;

    setBookingTripId(tripId);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      setBookingTripId(null);
      return;
    }

    const { error } = await bookTripOnly(supabase, {
      userId: user.id,
      tripId,
      familyMemberIds: Array.from(selected),
    });

    setBookingTripId(null);

    if (error) {
      if (error.message.includes("Already booked")) {
        showToast(t("trips.alreadyBooked"), "error");
      } else {
        showToast(t("common.error"), "error");
      }
      return;
    }

    showToast(t("trips.bookedNoBus"), "success");
    setSelectedFamilyByTrip((prev) => {
      const next = { ...prev };
      delete next[tripId];
      return next;
    });
    loadData();
  }

  if (loading) {
    return <LoadingSpinner text={t("common.loading")} />;
  }

  return (
    <div className="animate-fade-in">
      <h1 className="section-title mb-6">{t("trips.title")}</h1>

      {trips.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-20 h-20 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-800 dark:to-gray-900 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm">
            <CalendarDays className="w-10 h-10 text-slate-300 dark:text-gray-600" />
          </div>
          <p className="text-lg text-slate-400 dark:text-gray-500">{t("trips.noTrips")}</p>
        </div>
      ) : (
        <div className="space-y-5">
          {trips.map((trip) => {
            const booked = bookedTripIds.has(trip.id);
            const passengers = passengersByTrip[trip.id] || [];
            const isExpanded = expandedTrips.has(trip.id);
            const visiblePassengers = isExpanded ? passengers : passengers.slice(0, 5);
            const hiddenCount = passengers.length - 5;

            return (
              <Card key={trip.id} className="overflow-hidden hover:shadow-md transition-shadow duration-300">
                <CardHeader className={cn(
                  "pb-3",
                  booked
                    ? "bg-gradient-to-l from-emerald-50/80 to-emerald-50/30 dark:from-emerald-950/20 dark:to-transparent"
                    : "bg-gradient-to-l from-blue-50/80 to-blue-50/30 dark:from-blue-950/20 dark:to-transparent"
                )}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-xl">{getTripTitle(trip)}</CardTitle>
                        {booked ? (
                          <Badge variant="success" className="text-xs">
                            <Check className="w-3.5 h-3.5" />
                            {t("trips.alreadyBooked")}
                          </Badge>
                        ) : (
                          <Badge variant="default" className="text-xs">
                            <MapPin className="w-3.5 h-3.5" />
                            {t("trips.date")}: {trip.trip_date}
                          </Badge>
                        )}
                      </div>
                      {!booked && (
                        <p className="text-slate-400 dark:text-gray-500 text-sm">{t("trips.date")}: {trip.trip_date}</p>
                      )}
                      {passengers.length > 0 && (
                        <Badge variant="secondary" className="text-xs w-fit">
                          <Users className="w-3.5 h-3.5" />
                          {t("admin.passengersList")}: {passengers.length}
                        </Badge>
                      )}
                    </div>

                    <div className="shrink-0 flex flex-col gap-2">
                      {!booked && (
                        <>
                          {familyMembers.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled
                                className="border-blue-300 bg-blue-50/80 text-blue-700 dark:border-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
                              >
                                {t("family.me")}
                              </Button>
                              {familyMembers.map((fm) => {
                                const selected = getSelectedForTrip(trip.id);
                                return (
                                  <Button
                                    key={fm.id}
                                    variant="outline"
                                    size="sm"
                                    onClick={() => toggleFamilyMember(trip.id, fm.id)}
                                    className={cn(
                                      "transition-all duration-200 active:scale-95",
                                      selected.has(fm.id)
                                        ? "border-purple-400 bg-purple-50 text-purple-700 dark:border-purple-500 dark:bg-purple-950/50 dark:text-purple-400 shadow-sm"
                                        : "hover:bg-slate-50 dark:hover:bg-gray-800"
                                    )}
                                  >
                                    {fm.full_name}
                                    {fm.has_wheelchair && " ♿"}
                                  </Button>
                                );
                              })}
                              {getSelectedForTrip(trip.id).size > 0 && (
                                <Badge variant="purple" className="self-center text-xs">
                                  {1 + getSelectedForTrip(trip.id).size}
                                </Badge>
                              )}
                            </div>
                          )}
                          <div className="flex flex-col gap-2">
                            <Button
                              variant="default"
                              onClick={() => router.push(`/trips/${trip.id}/buses`)}
                              className="gap-2"
                            >
                              <Bus className="w-5 h-5" />
                              {t("trips.bookNow")}
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() => handleBookTrip(trip.id)}
                              disabled={bookingTripId !== null}
                            >
                              {bookingTripId === trip.id ? t("common.loading") : t("trips.bookTrip")}
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>

                {passengers.length > 0 && (
                  <CardContent className="pt-3">
                    <div className="border-t border-slate-100 dark:border-gray-800 pt-3">
                      <div className="flex flex-wrap gap-2 items-center">
                        {visiblePassengers.map((p, i) => {
                          const isFamily = !!p.family_member_id;
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
                              {p.sector_name && (
                                <span className="text-xs opacity-60">({p.sector_name})</span>
                              )}
                            </div>
                          );
                        })}
                        {!isExpanded && hiddenCount > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedTrips((prev) => new Set(prev).add(trip.id))}
                            className="text-blue-600 dark:text-blue-400 gap-1"
                          >
                            <ChevronDown className="w-4 h-4" />
                            +{hiddenCount} {t("admin.showMore")}
                          </Button>
                        )}
                        {isExpanded && passengers.length > 5 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedTrips((prev) => {
                              const next = new Set(prev);
                              next.delete(trip.id);
                              return next;
                            })}
                            className="text-blue-600 dark:text-blue-400 gap-1"
                          >
                            <ChevronUp className="w-4 h-4" />
                            {t("admin.showLess")}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {myBookings.length > 0 && (
        <div className="mt-10">
          <h2 className="section-title mb-4">{t("trips.myBookings")}</h2>
          <div className="space-y-3">
            {myBookings.map((booking) => {
              const fm = booking.family_members as unknown as { full_name: string } | null;
              const busInfo = booking.buses as unknown as { area_name_ar: string; area_name_en: string } | null;
              const tripTitle = booking.trips ? getTripTitle(booking.trips as Trip) : "";
              return (
                <Card key={booking.id} className="overflow-hidden hover:shadow-md transition-shadow duration-300">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 sm:p-6">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12 shadow-sm">
                        <AvatarFallback className={cn(
                          "bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/30",
                          fm ? "text-purple-700 dark:text-purple-400" : "text-blue-700 dark:text-blue-400"
                        )}>
                          {fm ? getInitials(fm.full_name) : <Check className="w-5 h-5" />}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="text-base font-bold text-slate-800 dark:text-gray-100">
                          {tripTitle}
                          {fm && (
                            <Badge variant="purple" className="ms-2 text-xs">
                              ↳ {fm.full_name}
                            </Badge>
                          )}
                        </h3>
                        {busInfo && (
                          <div className="flex items-center gap-1.5 text-sm text-slate-400 dark:text-gray-500 mt-0.5">
                            <Bus className="w-3.5 h-3.5" />
                            {t("confirm.bus")}: {lang === "ar" ? busInfo.area_name_ar : busInfo.area_name_en}
                          </div>
                        )}
                      </div>
                    </div>
                    {!fm && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleCancelBooking(booking.id)}
                        disabled={cancellingId !== null}
                        className="gap-1.5"
                      >
                        <X className="w-4 h-4" />
                        {cancellingId === booking.id ? t("common.loading") : t("admin.cancelBooking")}
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
