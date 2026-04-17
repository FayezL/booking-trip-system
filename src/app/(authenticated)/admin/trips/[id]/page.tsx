"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import OverviewTab from "./OverviewTab";
import BusesTab from "./BusesTab";
import RoomsTab from "./RoomsTab";
import UnbookedTab from "./UnbookedTab";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { Trip } from "@/lib/types/database";

type Tab = "overview" | "buses" | "rooms" | "unbooked";

export default function TripDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id: tripId } = params;
  const { t, lang } = useTranslation();
  const router = useRouter();
  const supabase = createClient();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);

  const loadTrip = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("trips")
        .select("*")
        .eq("id", tripId)
        .single();
      setTrip(data);
    } catch {
      setTrip(null);
    } finally {
      setLoading(false);
    }
  }, [tripId, supabase]);

  useEffect(() => {
    loadTrip();
  }, [loadTrip]);

  if (loading) {
    return <LoadingSpinner text={t("common.loading")} />;
  }

  if (!trip) {
    return <p className="text-center py-20 text-slate-400 dark:text-gray-500">{t("common.error")}</p>;
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: t("admin.overview") },
    { key: "buses", label: t("admin.buses") },
    { key: "rooms", label: t("admin.rooms") },
    { key: "unbooked", label: t("admin.unbooked") },
  ];

  return (
    <div className="animate-fade-in">
      <button
        onClick={() => router.push("/admin/trips")}
        className="mb-4 text-blue-600 dark:text-blue-400 font-semibold text-base hover:text-blue-700 dark:hover:text-blue-300 transition-colors inline-flex items-center gap-1"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l7-7-7-7" />
        </svg>
        {t("admin.backToTrips")}
      </button>

      <h1 className="section-title mb-1">
        {lang === "ar" ? trip.title_ar : trip.title_en}
      </h1>
      <p className="text-slate-400 dark:text-gray-500 mb-4 text-sm">{trip.trip_date}</p>

      <div className="flex gap-1 mb-6 border-b border-slate-200 dark:border-gray-800 overflow-x-auto hide-scrollbar -mx-4 px-4" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            aria-controls={`tabpanel-${tab.key}`}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-base font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? "border-blue-600 dark:border-blue-400 text-blue-700 dark:text-blue-400"
                : "border-transparent text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`tabpanel-${activeTab}`}>

      {activeTab === "overview" && <OverviewTab tripId={tripId} onSwitchTab={setActiveTab} />}
      {activeTab === "buses" && <BusesTab tripId={tripId} />}
      {activeTab === "rooms" && <RoomsTab tripId={tripId} />}
      {activeTab === "unbooked" && <UnbookedTab tripId={tripId} />}
      </div>
    </div>
  );
}
