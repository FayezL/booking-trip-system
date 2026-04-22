"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useToast } from "@/components/Toast";
import LoadingSpinner from "@/components/LoadingSpinner";
import { bookTripOnly, toggleInSet } from "@/lib/booking";
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
  const [selectedFamilyIds, setSelectedFamilyIds] = useState<Set<string>>(new Set());
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

  function toggleFamilyMember(id: string) {
    setSelectedFamilyIds(toggleInSet(selectedFamilyIds, id));
  }

  async function handleBookTrip(tripId: string) {
    const totalPeople = 1 + selectedFamilyIds.size;
    const msg = selectedFamilyIds.size > 0
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
      familyMemberIds: Array.from(selectedFamilyIds),
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
    setSelectedFamilyIds(new Set());
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
          <div className="w-16 h-16 bg-slate-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-slate-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-lg text-slate-400 dark:text-gray-500">{t("trips.noTrips")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {trips.map((trip) => {
            const booked = bookedTripIds.has(trip.id);
            const passengers = passengersByTrip[trip.id] || [];
            const isExpanded = expandedTrips.has(trip.id);
            const visiblePassengers = isExpanded ? passengers : passengers.slice(0, 5);
            const hiddenCount = passengers.length - 5;

            return (
              <div key={trip.id} className="card">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-gray-100">{getTripTitle(trip)}</h2>
                    <p className="text-slate-400 dark:text-gray-500 mt-1 text-sm">{t("trips.date")}: {trip.trip_date}</p>
                    {passengers.length > 0 && (
                      <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">
                        {t("admin.passengersList")}: {passengers.length}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 flex flex-col gap-2">
                    {booked ? (
                      <span className="badge-green">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        {t("trips.alreadyBooked")}
                      </span>
                    ) : (
                      <>
                        {familyMembers.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            <span className="px-2 py-1 rounded-lg text-xs font-semibold border border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-400 min-h-[32px] inline-flex items-center">
                              {t("family.me")}
                            </span>
                            {familyMembers.map((fm) => (
                              <button
                                key={fm.id}
                                type="button"
                                onClick={() => toggleFamilyMember(fm.id)}
                                className={`px-2 py-1 rounded-lg text-xs font-semibold border min-h-[32px] inline-flex items-center gap-1 transition-all duration-150 active:scale-95 ${
                                  selectedFamilyIds.has(fm.id)
                                    ? "border-purple-400 bg-purple-50 text-purple-700 dark:border-purple-500 dark:bg-purple-950/50 dark:text-purple-400"
                                    : "border-slate-200 bg-white text-slate-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
                                }`}
                              >
                                {fm.full_name}
                                {fm.has_wheelchair && " ♿"}
                              </button>
                            ))}
                            {selectedFamilyIds.size > 0 && (
                              <span className="text-xs text-slate-400 dark:text-gray-500 self-center">
                                ({1 + selectedFamilyIds.size})
                              </span>
                            )}
                          </div>
                        )}
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => router.push(`/trips/${trip.id}/buses`)}
                            className="btn-secondary w-full sm:w-auto"
                          >
                            {t("trips.bookNow")}
                          </button>
                          <button
                            onClick={() => handleBookTrip(trip.id)}
                            disabled={bookingTripId !== null}
                            className="btn-primary w-full sm:w-auto"
                          >
                            {bookingTripId === trip.id ? t("common.loading") : t("trips.bookTrip")}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {passengers.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-gray-800">
                    <div className="text-sm text-slate-500 dark:text-gray-400">
                      {visiblePassengers.map((p, i) => (
                         <span key={i}>
                           {p.family_member_id && <span className="text-purple-400">↳ </span>}
                           {p.full_name}{p.has_wheelchair && " ♿"}{p.sector_name ? ` (${p.sector_name})` : ""}{i < visiblePassengers.length - 1 ? "، " : ""}
                         </span>
                       ))}
                      {!isExpanded && hiddenCount > 0 && (
                        <button
                          onClick={() => setExpandedTrips((prev) => new Set(prev).add(trip.id))}
                          className="text-blue-600 dark:text-blue-400 font-medium ms-1 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                        >
                          +{hiddenCount} {t("admin.showMore")}
                        </button>
                      )}
                      {isExpanded && passengers.length > 5 && (
                        <button
                          onClick={() => setExpandedTrips((prev) => {
                            const next = new Set(prev);
                            next.delete(trip.id);
                            return next;
                          })}
                          className="text-blue-600 dark:text-blue-400 font-medium ms-1 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                        >
                          {t("admin.showLess")}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
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
              return (
                <div key={booking.id} className="card">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-50 dark:bg-blue-950/30 rounded-xl flex items-center justify-center shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-800 dark:text-gray-100">
                          {booking.trips ? getTripTitle(booking.trips as Trip) : ""}
                          {fm && <span className="text-sm font-normal text-purple-500 dark:text-purple-400 ms-2">↳ {fm.full_name}</span>}
                        </h3>
                        {busInfo && (
                          <p className="text-sm text-slate-400 dark:text-gray-500">
                            {t("confirm.bus")}: {lang === "ar" ? busInfo.area_name_ar : busInfo.area_name_en}
                          </p>
                        )}
                      </div>
                    </div>
                    {!fm && (
                      <button
                        onClick={() => handleCancelBooking(booking.id)}
                        disabled={cancellingId !== null}
                        className="btn-danger w-full sm:w-auto"
                      >
                        {cancellingId === booking.id ? t("common.loading") : t("admin.cancelBooking")}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
