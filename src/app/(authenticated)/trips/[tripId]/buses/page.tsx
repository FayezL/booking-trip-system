"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useToast } from "@/components/Toast";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { Bus, Trip } from "@/lib/types/database";

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
          .select("bus_id, profiles(full_name, has_wheelchair)")
          .eq("trip_id", tripId)
          .is("cancelled_at", null),
      ]);

      if (tripRes.data) setTrip(tripRes.data);

      const passengersByBus: Record<string, PassengerInfo[]> = {};
      for (const b of bookingsRes.data || []) {
        const list = passengersByBus[b.bus_id] || [];
        if (b.profiles) {
          const p = b.profiles as { full_name: string; has_wheelchair: boolean };
          list.push({ full_name: p.full_name, has_wheelchair: p.has_wheelchair });
        }
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
      <div className="max-w-md mx-auto text-center py-8 animate-slide-up">
        <div className="w-20 h-20 bg-blue-50 dark:bg-blue-950/30 rounded-full flex items-center justify-center mx-auto mb-6">
           <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-6">{t("confirm.title")}</h1>
        <div className="card text-start space-y-4">
          {[
            { label: t("confirm.trip"), value: confirmation.tripTitle },
            { label: t("confirm.bus"), value: confirmation.busLabel },
            { label: t("confirm.leader"), value: confirmation.leaderName },
            { label: t("confirm.date"), value: confirmation.tripDate },
          ].map((item) => (
            <div key={item.label} className="flex justify-between items-center py-2 border-b border-slate-50 dark:border-gray-800 last:border-0">
               <span className="text-slate-400 dark:text-gray-500 text-sm">{item.label}</span>
               <span className="font-semibold text-slate-800 dark:text-gray-100">{item.value}</span>
            </div>
          ))}
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
    <div className="animate-fade-in">
      <button
        onClick={() => router.push("/trips")}
        className="mb-4 text-blue-600 dark:text-blue-400 font-semibold text-base hover:text-blue-700 dark:hover:text-blue-300 transition-colors inline-flex items-center gap-1"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l7-7-7-7" />
        </svg>
        {t("buses.back")}
      </button>

      <h1 className="section-title mb-2">{t("buses.chooseBus")}</h1>
      {trip && (
        <p className="text-slate-400 dark:text-gray-500 mb-6 text-sm">
          {lang === "ar" ? trip.title_ar : trip.title_en} — {t("trips.date")}: {trip.trip_date}
        </p>
      )}

      {areaGroups.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-slate-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-slate-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-lg text-slate-400 dark:text-gray-500">{t("admin.bookingSoon")}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {areaGroups.map((group) => (
            <div key={group.areaId || group.areaName}>
              <h2 className="text-lg font-bold text-blue-700 dark:text-blue-400 mb-3">{group.areaName}</h2>
              <div className="space-y-3">
                {group.buses.map((bus) => {
                  const available = bus.capacity - bus.booking_count;
                  const isFull = available <= 0;
                  const percent = Math.min((bus.booking_count / bus.capacity) * 100, 100);
                  const displayName = bus.bus_label || group.areaName;
                  const showAll = expandedBuses.has(bus.id);
                  const visiblePassengers = showAll ? bus.passengers : bus.passengers.slice(0, 5);
                  const hiddenCount = bus.passengers.length - 5;
                  const fillClass = isFull ? "danger" : percent > 80 ? "warning" : "";

                  return (
                    <div key={bus.id} className={`card ${isFull ? "opacity-60" : ""}`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                        <div>
                          <h3 className="text-lg font-bold text-slate-800 dark:text-gray-100">{displayName}</h3>
                          {bus.leader_name && (
                            <p className="text-slate-400 dark:text-gray-500 mt-0.5 text-sm">
                              {t("buses.leader")}: {bus.leader_name}
                            </p>
                          )}
                        </div>

                        {isFull ? (
                          <span className="badge-red shrink-0 self-start sm:self-auto">
                            {t("buses.full")}
                          </span>
                        ) : (
                          <button
                            onClick={() => handleBook(bus)}
                            disabled={bookingBusId !== null}
                            className="btn-primary w-full sm:w-auto shrink-0"
                          >
                            {bookingBusId === bus.id ? t("common.loading") : t("buses.choose")}
                          </button>
                        )}
                      </div>

                      <div className="mt-3">
                        <div className="flex justify-between text-sm text-slate-400 dark:text-gray-500 mb-1.5">
                          <span>{t("buses.availableSeats")}: {available}</span>
                          <span>{bus.booking_count}/{bus.capacity}</span>
                        </div>
                        <div className="progress-bar">
                          <div
                            className={`progress-bar-fill ${fillClass}`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>

                      {bus.passengers.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-50 dark:border-gray-800">
                          <p className="text-xs font-medium text-slate-300 dark:text-gray-600 mb-1">
                            {t("admin.passengersList")} ({bus.passengers.length})
                          </p>
                          <div className="text-sm text-slate-500 dark:text-gray-400">
                            {visiblePassengers.map((p, i) => (
                              <span key={i}>
                                {p.full_name}{p.has_wheelchair && " ♿"}{i < visiblePassengers.length - 1 ? "، " : ""}
                              </span>
                            ))}
                            {!showAll && hiddenCount > 0 && (
                              <button
                                onClick={() => toggleExpand(bus.id)}
                                className="text-blue-600 dark:text-blue-400 font-medium ms-1 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                              >
                                +{hiddenCount} {t("admin.showMore")}
                              </button>
                            )}
                          </div>
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
