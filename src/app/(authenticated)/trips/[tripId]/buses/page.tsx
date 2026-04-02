"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useToast } from "@/components/Toast";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { Bus, Trip } from "@/lib/types/database";

type BusWithCount = Bus & { booking_count: number };

type BookingConfirmation = {
  tripTitle: string;
  busArea: string;
  leaderName: string;
  tripDate: string;
};

export default function BusesPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = use(params);
  const { t, lang } = useTranslation();
  const router = useRouter();
  const supabase = createClient();
  const { showToast } = useToast();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [buses, setBuses] = useState<BusWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingBusId, setBookingBusId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);

  useEffect(() => {
    async function loadData() {
      const [tripRes, busesRes] = await Promise.all([
        supabase.from("trips").select("*").eq("id", tripId).single(),
        supabase.from("buses").select("*").eq("trip_id", tripId),
      ]);

      if (tripRes.data) setTrip(tripRes.data);

      const busList = (busesRes.data || []) as Bus[];
      const busesWithCounts = await Promise.all(
        busList.map(async (bus) => {
          const { count } = await supabase
            .from("bookings")
            .select("*", { count: "exact", head: true })
            .eq("bus_id", bus.id)
            .is("cancelled_at", null);
          return { ...bus, booking_count: count || 0 };
        })
      );

      setBuses(busesWithCounts);
      setLoading(false);
    }

    loadData();
  }, [tripId]);

  async function handleBook(bus: BusWithCount) {
    const areaName = lang === "ar" ? bus.area_name_ar : bus.area_name_en;
    const confirmed = confirm(`${t("buses.choose")}: ${areaName}?`);
    if (!confirmed) return;

    setBookingBusId(bus.id);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const { error } = await supabase.from("bookings").insert({
      user_id: user.id,
      trip_id: tripId,
      bus_id: bus.id,
    });

    if (error) {
      if (error.message.includes("unique") || error.message.includes("duplicate")) {
        showToast(t("trips.alreadyBooked"), "error");
      } else {
        showToast(t("common.error"), "error");
      }
      setBookingBusId(null);
      return;
    }

    setConfirmation({
      tripTitle: trip ? (lang === "ar" ? trip.title_ar : trip.title_en) : "",
      busArea: areaName,
      leaderName: bus.leader_name || "-",
      tripDate: trip?.trip_date || "",
    });
  }

  if (loading) {
    return <LoadingSpinner text={t("common.loading")} />;
  }

  if (confirmation) {
    return (
      <div className="max-w-md mx-auto text-center py-10">
        <div className="mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-20 h-20 mx-auto text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-emerald-600 mb-6">{t("confirm.title")}</h1>
        <div className="card text-start space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-500">{t("confirm.trip")}</span>
            <span className="font-semibold">{confirmation.tripTitle}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">{t("confirm.bus")}</span>
            <span className="font-semibold">{confirmation.busArea}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">{t("confirm.leader")}</span>
            <span className="font-semibold">{confirmation.leaderName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">{t("confirm.date")}</span>
            <span className="font-semibold">{confirmation.tripDate}</span>
          </div>
        </div>
        <button
          onClick={() => router.push("/trips")}
          className="btn-primary w-full mt-6"
        >
          {t("confirm.ok")}
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => router.push("/trips")}
        className="mb-4 text-emerald-600 font-semibold text-lg hover:underline"
      >
        ← {t("buses.back")}
      </button>

      <h1 className="text-2xl font-bold mb-2">{t("buses.chooseBus")}</h1>
      {trip && (
        <p className="text-gray-600 mb-6">
          {lang === "ar" ? trip.title_ar : trip.title_en} — {t("trips.date")}: {trip.trip_date}
        </p>
      )}

      {buses.length === 0 ? (
        <p className="text-xl text-gray-500 text-center py-10">{t("trips.noTrips")}</p>
      ) : (
        <div className="space-y-4">
          {buses.map((bus) => {
            const available = bus.capacity - bus.booking_count;
            const isFull = available <= 0;
            const percent = Math.min((bus.booking_count / bus.capacity) * 100, 100);

            return (
              <div key={bus.id} className={`card ${isFull ? "opacity-60" : ""}`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-xl font-bold">
                      {lang === "ar" ? bus.area_name_ar : bus.area_name_en}
                    </h2>
                    {bus.leader_name && (
                      <p className="text-gray-500 mt-1">
                        {t("buses.leader")}: {bus.leader_name}
                      </p>
                    )}
                  </div>

                  {isFull ? (
                    <span className="px-4 py-2 rounded-lg bg-red-100 text-red-700 text-lg font-semibold">
                      {t("buses.full")}
                    </span>
                  ) : (
                    <button
                      onClick={() => handleBook(bus)}
                      disabled={bookingBusId !== null}
                      className="btn-primary"
                    >
                      {bookingBusId === bus.id ? t("common.loading") : t("buses.choose")}
                    </button>
                  )}
                </div>

                <div className="mt-3">
                  <div className="flex justify-between text-sm text-gray-500 mb-1">
                    <span>{t("buses.availableSeats")}: {available}</span>
                    <span>{bus.booking_count}/{bus.capacity}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        isFull ? "bg-red-500" : percent > 80 ? "bg-yellow-500" : "bg-emerald-500"
                      }`}
                      style={{ width: `${percent}%` }}
                    />
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
