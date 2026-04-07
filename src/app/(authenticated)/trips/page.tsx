"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useToast } from "@/components/Toast";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { Trip, Booking } from "@/lib/types/database";

export default function TripsPage() {
  const { t, lang } = useTranslation();
  const router = useRouter();
  const supabase = createClient();
  const { showToast } = useToast();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [myBookings, setMyBookings] = useState<(Booking & { trips: Trip; buses: { area_name_ar: string; area_name_en: string } })[]>([]);
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

      setTrips(tripsRes.data || []);
      setMyBookings((bookingsRes.data || []) as unknown as typeof myBookings);
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
            return (
              <div key={trip.id} className="card">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-gray-100">{getTripTitle(trip)}</h2>
                    <p className="text-slate-400 dark:text-gray-500 mt-1 text-sm">{t("trips.date")}: {trip.trip_date}</p>
                  </div>

                  <div className="shrink-0">
                    {booked ? (
                      <span className="badge-green">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        {t("trips.alreadyBooked")}
                      </span>
                    ) : (
                      <button
                        onClick={() => router.push(`/trips/${trip.id}/buses`)}
                        className="btn-primary w-full sm:w-auto"
                      >
                        {t("trips.bookNow")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {myBookings.length > 0 && (
        <div className="mt-10">
          <h2 className="section-title mb-4">{t("trips.myBookings")}</h2>
          <div className="space-y-3">
            {myBookings.map((booking) => (
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
                      </h3>
                       <p className="text-sm text-slate-400 dark:text-gray-500">
                        {t("confirm.bus")}: {lang === "ar" ? booking.buses.area_name_ar : booking.buses.area_name_en}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCancelBooking(booking.id)}
                    disabled={cancellingId !== null}
                    className="btn-danger w-full sm:w-auto"
                  >
                    {cancellingId === booking.id ? t("common.loading") : t("admin.cancelBooking")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
