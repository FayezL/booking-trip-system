"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useToast } from "@/components/Toast";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { Bus, Trip } from "@/lib/types/database";

type BusWithCount = Bus & { booking_count: number; passengers: string[] };

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
      const [tripRes, busesRes, bookingsRes] = await Promise.all([
        supabase.from("trips").select("*").eq("id", tripId).single(),
        supabase.from("buses").select("*").eq("trip_id", tripId),
        supabase
          .from("bookings")
          .select("bus_id, profiles(full_name)")
          .eq("trip_id", tripId)
          .is("cancelled_at", null),
      ]);

      if (tripRes.data) setTrip(tripRes.data);

      const passengersByBus: Record<string, string[]> = {};
      for (const b of bookingsRes.data || []) {
        const list = passengersByBus[b.bus_id] || [];
        if (b.profiles) list.push((b.profiles as { full_name: string }).full_name);
        passengersByBus[b.bus_id] = list;
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
            <span className="font-semibold">{confirmation.busLabel}</span>
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

      {areaGroups.length === 0 ? (
        <p className="text-xl text-gray-500 text-center py-10">{t("trips.noTrips")}</p>
      ) : (
        <div className="space-y-6">
          {areaGroups.map((group) => (
            <div key={group.areaId || group.areaName}>
              <h2 className="text-xl font-bold text-emerald-700 mb-3">{group.areaName}</h2>
              <div className="space-y-4">
                {group.buses.map((bus) => {
                  const available = bus.capacity - bus.booking_count;
                  const isFull = available <= 0;
                  const percent = Math.min((bus.booking_count / bus.capacity) * 100, 100);
                  const displayName = bus.bus_label || group.areaName;
                  const showAll = expandedBuses.has(bus.id);
                  const visiblePassengers = showAll ? bus.passengers : bus.passengers.slice(0, 5);
                  const hiddenCount = bus.passengers.length - 5;

                  return (
                    <div key={bus.id} className={`card ${isFull ? "opacity-60" : ""}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="text-xl font-bold">{displayName}</h3>
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

                      {bus.passengers.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <p className="text-xs font-medium text-gray-400 mb-1">
                            {t("admin.passengersList")} ({bus.passengers.length})
                          </p>
                          <p className="text-sm text-gray-600">
                            {visiblePassengers.join("، ")}
                            {!showAll && hiddenCount > 0 && (
                              <button
                                onClick={() => toggleExpand(bus.id)}
                                className="text-emerald-600 font-medium ms-1 hover:underline"
                              >
                                +{hiddenCount} {t("admin.showMore")}
                              </button>
                            )}
                          </p>
                        </div>
                      )}
                    </div>
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
