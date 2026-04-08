"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useToast } from "@/components/Toast";
import type { Trip, Booking } from "@/lib/types/database";
import PageBreadcrumbs from "@/components/PageBreadcrumbs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Calendar, Users, ChevronDown, ChevronUp, CalendarX, Ticket } from "lucide-react";

type Passenger = { bus_id: string; full_name: string; has_wheelchair: boolean };

export default function TripsPage() {
  const { t, lang } = useTranslation();
  const router = useRouter();
  const supabase = createClient();
  const { showToast } = useToast();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [myBookings, setMyBookings] = useState<(Booking & { trips: Trip; buses: { area_name_ar: string; area_name_en: string } })[]>([]);
  const [passengersByTrip, setPassengersByTrip] = useState<Record<string, Passenger[]>>({});
  const [expandedTrips, setExpandedTrips] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  async function loadData() {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) {
        console.error("Failed to get user:", authError);
      }
      if (!user) return;

      const [tripsRes, bookingsRes] = await Promise.all([
        supabase.from("trips").select("*").eq("is_open", true).order("trip_date", { ascending: false }),
        supabase
          .from("bookings")
          .select("*, trips(*), buses(area_name_ar, area_name_en)")
          .eq("user_id", user.id)
          .is("cancelled_at", null),
      ]);

      if (tripsRes.error) {
        console.error("Failed to load trips:", tripsRes.error);
      }
      if (bookingsRes.error) {
        console.error("Failed to load bookings:", bookingsRes.error);
      }

      const tripsData = tripsRes.data || [];
      setTrips(tripsData);
      setMyBookings((bookingsRes.data || []) as unknown as typeof myBookings);

      if (tripsData.length > 0) {
        const passengerMap: Record<string, Passenger[]> = {};
        await Promise.all(
          tripsData.map(async (trip: Trip) => {
            const { data } = await supabase.rpc("get_trip_passengers", { p_trip_id: trip.id });
            passengerMap[trip.id] = (data || []) as Passenger[];
          })
        );
        setPassengersByTrip(passengerMap);
      }

      setLoading(false);
    } catch (err) {
      console.error("Unexpected error in loadData:", err);
      setLoading(false);
    }
  }

  const bookedTripIds = useMemo(() => new Set(myBookings.map((b) => b.trip_id)), [myBookings]);

  useEffect(() => {
    loadData();
  }, []);

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

  if (loading) {
    return (
      <div className="animate-fade-in">
        <PageBreadcrumbs items={[{ label: t("trips.title") }]} />
        <div className="mt-6 grid gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-9 w-24" />
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
      <PageBreadcrumbs items={[{ label: t("trips.title") }]} />

      {trips.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CalendarX className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-lg text-muted-foreground">{t("trips.noTrips")}</p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {trips.map((trip) => {
            const booked = bookedTripIds.has(trip.id);
            const passengers = passengersByTrip[trip.id] || [];
            const isExpanded = expandedTrips.has(trip.id);
            const visiblePassengers = isExpanded ? passengers : passengers.slice(0, 5);
            const hiddenCount = passengers.length - 5;

            return (
              <Card
                key={trip.id}
                className={booked ? "" : "cursor-pointer hover:shadow-md transition-shadow"}
                onClick={booked ? undefined : () => router.push(`/trips/${trip.id}/buses`)}
              >
                <CardContent>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1">
                      <h2 className="text-xl font-bold">{getTripTitle(trip)}</h2>
                      <p className="text-muted-foreground mt-1 text-sm flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {t("trips.date")}: {trip.trip_date}
                      </p>
                      {passengers.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5" />
                          {t("admin.passengersList")}: {passengers.length}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                      {booked ? (
                        <Badge variant="default">
                          {t("trips.alreadyBooked")}
                        </Badge>
                      ) : (
                        <Button
                          variant="default"
                          className="w-full sm:w-auto"
                          onClick={() => router.push(`/trips/${trip.id}/buses`)}
                        >
                          <Ticket className="w-4 h-4" />
                          {t("trips.bookNow")}
                        </Button>
                      )}
                    </div>
                  </div>

                  {passengers.length > 0 && (
                    <div className="mt-3 pt-3">
                      <Separator />
                      <div className="text-sm text-muted-foreground pt-3">
                        {visiblePassengers.map((p, i) => (
                          <span key={i}>
                            {p.full_name}{p.has_wheelchair && " ♿"}{i < visiblePassengers.length - 1 ? "، " : ""}
                          </span>
                        ))}
                        {!isExpanded && hiddenCount > 0 && (
                          <Button
                            variant="link"
                            size="sm"
                            className="ms-1 p-0 h-auto text-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedTrips((prev) => new Set(prev).add(trip.id));
                            }}
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                            +{hiddenCount} {t("admin.showMore")}
                          </Button>
                        )}
                        {isExpanded && passengers.length > 5 && (
                          <Button
                            variant="link"
                            size="sm"
                            className="ms-1 p-0 h-auto text-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedTrips((prev) => {
                                const next = new Set(prev);
                                next.delete(trip.id);
                                return next;
                              });
                            }}
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
      )}

      {myBookings.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xl font-bold mb-4">{t("trips.myBookings")}</h2>
          <div className="space-y-3">
            {myBookings.map((booking) => (
              <Card key={booking.id}>
                <CardContent>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                        <Ticket className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold">
                          {booking.trips ? getTripTitle(booking.trips as Trip) : ""}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {t("confirm.bus")}: {lang === "ar" ? booking.buses.area_name_ar : booking.buses.area_name_en}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={() => handleCancelBooking(booking.id)}
                      disabled={cancellingId !== null}
                    >
                      {cancellingId === booking.id ? t("common.loading") : t("admin.cancelBooking")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
