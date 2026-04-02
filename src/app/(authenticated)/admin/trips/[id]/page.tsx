"use client";

import { useState, useEffect, use } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import BusesTab from "./BusesTab";
import RoomsTab from "./RoomsTab";
import UnbookedTab from "./UnbookedTab";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { Trip } from "@/lib/types/database";

type Tab = "buses" | "rooms" | "unbooked";

export default function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: tripId } = use(params);
  const { t, lang } = useTranslation();
  const supabase = createClient();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("buses");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTrip() {
      const { data } = await supabase
        .from("trips")
        .select("*")
        .eq("id", tripId)
        .single();
      setTrip(data);
      setLoading(false);
    }
    loadTrip();
  }, [tripId]);

  if (loading) {
    return <LoadingSpinner text={t("common.loading")} />;
  }

  if (!trip) {
    return <p className="text-center py-20 text-gray-500">{t("common.error")}</p>;
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "buses", label: t("admin.buses") },
    { key: "rooms", label: t("admin.rooms") },
    { key: "unbooked", label: t("admin.unbooked") },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">
        {lang === "ar" ? trip.title_ar : trip.title_en}
      </h1>
      <p className="text-gray-500 mb-4">{trip.trip_date}</p>

      <div className="flex gap-2 mb-6 border-b border-gray-200 pb-0">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-lg font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "buses" && <BusesTab tripId={tripId} />}
      {activeTab === "rooms" && <RoomsTab tripId={tripId} />}
      {activeTab === "unbooked" && <UnbookedTab tripId={tripId} />}
    </div>
  );
}
