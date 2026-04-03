"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import LoadingSpinner from "@/components/LoadingSpinner";
import RoomsTab from "../trips/[id]/RoomsTab";
import type { Trip } from "@/lib/types/database";

export default function RoomsOverviewPage() {
  const { t } = useTranslation();
  const supabase = createClient();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTrips() {
      const { data } = await supabase
        .from("trips")
        .select("*")
        .order("trip_date", { ascending: false });
      setTrips(data || []);
      const firstOpen = (data || []).find((trip: Trip) => trip.is_open);
      if (firstOpen) setSelectedTrip(firstOpen.id);
      else if (data && data.length > 0) setSelectedTrip(data[0].id);
      setLoading(false);
    }
    loadTrips();
  }, []);

  if (loading) {
    return <LoadingSpinner text={t("common.loading")} />;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">{t("admin.roomsOverview")}</h1>

      <div className="mb-6">
        <label className="label-text">{t("admin.selectTrip")}</label>
        <select
          className="input-field max-w-md"
          value={selectedTrip}
          onChange={(e) => setSelectedTrip(e.target.value)}
        >
          <option value="">---</option>
          {trips.map((trip) => (
            <option key={trip.id} value={trip.id}>
              {trip.title_ar} — {trip.trip_date} {!trip.is_open ? `(${t("admin.isClosed")})` : ""}
            </option>
          ))}
        </select>
      </div>

      {selectedTrip ? (
        <RoomsTab tripId={selectedTrip} />
      ) : (
        <p className="text-gray-500 text-center py-10">{t("admin.selectTrip")}</p>
      )}
    </div>
  );
}
