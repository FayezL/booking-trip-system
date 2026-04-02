"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { Trip, Booking } from "@/lib/types/database";

export default function TripsPage() {
  const { t, lang } = useTranslation();
  const router = useRouter();
  const supabase = createClient();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const [tripsRes, bookingsRes] = await Promise.all([
        supabase.from("trips").select("*").order("trip_date", { ascending: false }),
        supabase
          .from("bookings")
          .select("*")
          .eq("user_id", user.id)
          .is("cancelled_at", null),
      ]);

      setTrips(tripsRes.data || []);
      setMyBookings(bookingsRes.data || []);
      setLoading(false);
    }

    loadData();
  }, []);

  function isBooked(tripId: string): boolean {
    return myBookings.some((b) => b.trip_id === tripId);
  }

  function getTripTitle(trip: Trip): string {
    return lang === "ar" ? trip.title_ar : trip.title_en;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-xl text-gray-500">{t("common.loading")}</p>
      </div>
    );
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
                    {!trip.is_open ? (
                      <span className="inline-block px-4 py-2 rounded-lg bg-gray-200 text-gray-600 text-lg font-semibold">
                        {t("trips.closed")}
                      </span>
                    ) : booked ? (
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
    </div>
  );
}
