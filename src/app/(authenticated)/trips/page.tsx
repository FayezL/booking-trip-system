"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { Trip, Booking } from "@/lib/types/database";

export default function TripsPage() {
  const { t, lang } = useTranslation();
  const router = useRouter();
  const supabase = createClient();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [myBookings, setMyBookings] = useState<(Booking & { trips: Trip; buses: { area_name_ar: string; area_name_en: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  async function loadData() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const [tripsRes, bookingsRes] = await Promise.all([
      supabase.from("trips").select("*").eq("is_open", true).order("trip_date", { ascending: false }),
      supabase
        .from("bookings")
        .select("*, trips(*), buses(area_name_ar, area_name_en)")
        .eq("user_id", user.id)
        .is("cancelled_at", null),
    ]);

    setTrips(tripsRes.data || []);
    setMyBookings((bookingsRes.data || []) as unknown as typeof myBookings);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function isBooked(tripId: string): boolean {
    return myBookings.some((b) => b.trip_id === tripId);
  }

  function getTripTitle(trip: Trip): string {
    return lang === "ar" ? trip.title_ar : trip.title_en;
  }

  async function handleCancelBooking(bookingId: string) {
    if (!confirm(t("admin.confirmCancel"))) return;
    setCancellingId(bookingId);
    const { error } = await supabase.rpc("cancel_booking", { p_booking_id: bookingId });
    setCancellingId(null);
    if (error) {
      return;
    }
    loadData();
  }

  if (loading) {
    return <LoadingSpinner text={t("common.loading")} />;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t("trips.title")}</h1>

      {trips.length === 0 ? (
        <p className="text-xl text-gray-500 text-center py-10">{t("trips.noTrips")}</p>
      ) : (
        <div className="space-y-4">
          {trips.map((trip) => {
            const booked = isBooked(trip.id);
            return (
              <div key={trip.id} className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold">{getTripTitle(trip)}</h2>
                    <p className="text-gray-500 mt-1">{t("trips.date")}: {trip.trip_date}</p>
                  </div>

                  <div>
                    {booked ? (
                      <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-100 text-emerald-700 text-lg font-semibold">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        {t("trips.alreadyBooked")}
                      </span>
                    ) : (
                      <button
                        onClick={() => router.push(`/trips/${trip.id}/buses`)}
                        className="btn-primary"
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
          <h2 className="text-xl font-bold mb-4">{t("trips.myBookings")}</h2>
          <div className="space-y-3">
            {myBookings.map((booking) => (
              <div key={booking.id} className="card flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <div>
                    <h3 className="text-lg font-bold">
                      {booking.trips ? getTripTitle(booking.trips as Trip) : ""}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {t("confirm.bus")}: {lang === "ar" ? booking.buses.area_name_ar : booking.buses.area_name_en}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleCancelBooking(booking.id)}
                  disabled={cancellingId !== null}
                  className="px-3 py-1.5 rounded-md text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                >
                  {cancellingId === booking.id ? t("common.loading") : t("admin.cancelBooking")}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
