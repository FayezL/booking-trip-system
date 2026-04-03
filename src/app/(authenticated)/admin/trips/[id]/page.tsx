"use client";

import { useState, useEffect } from "react";
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
    { key: "overview", label: t("admin.overview") },
    { key: "buses", label: t("admin.buses") },
    { key: "rooms", label: t("admin.rooms") },
    { key: "unbooked", label: t("admin.unbooked") },
  ];

  return (
    <div>
      <button
        onClick={() => router.push("/admin/trips")}
        className="mb-4 text-emerald-600 font-semibold text-lg hover:underline"
      >
        ← {t("admin.backToTrips")}
      </button>

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

      {activeTab === "overview" && <OverviewTab tripId={tripId} onSwitchTab={setActiveTab} />}
      {activeTab === "buses" && <BusesTab tripId={tripId} />}
      {activeTab === "rooms" && <RoomsTab tripId={tripId} />}
      {activeTab === "unbooked" && <UnbookedTab tripId={tripId} />}
    </div>
  );
}
