"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import OverviewTab from "./OverviewTab";
import BusesTab from "./BusesTab";
import RoomsTab from "./RoomsTab";
import UnbookedTab from "./UnbookedTab";
import CarsTab from "./CarsTab";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowRight, CalendarDays } from "lucide-react";
import type { Trip } from "@/lib/types/database";

type Tab = "overview" | "buses" | "rooms" | "cars" | "unbooked";

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

  return (
    <div className="animate-fade-in space-y-6">
      <Button
        variant="ghost"
        onClick={() => router.push("/admin/trips")}
        className="-mr-3 mb-0"
      >
        <ArrowRight className="w-5 h-5 rtl:rotate-180" />
        {t("admin.backToTrips")}
      </Button>

      <div>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/30">
            <CalendarDays className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="section-title leading-tight">
              {lang === "ar" ? trip.title_ar : trip.title_en}
            </h1>
            <p className="text-sm text-slate-400 dark:text-gray-500">{trip.trip_date}</p>
          </div>
          {trip.is_open ? (
            <Badge variant="success">{t("admin.isOpen")}</Badge>
          ) : (
            <Badge variant="destructive">{t("admin.isClosed")}</Badge>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-2">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Tab)}>
            <TabsList className="w-full flex overflow-x-auto hide-scrollbar">
              <TabsTrigger value="overview">{t("admin.overview")}</TabsTrigger>
              <TabsTrigger value="buses">{t("admin.buses")}</TabsTrigger>
              <TabsTrigger value="rooms">{t("admin.rooms")}</TabsTrigger>
              <TabsTrigger value="cars">{t("cars.title")}</TabsTrigger>
              <TabsTrigger value="unbooked">{t("admin.unbooked")}</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <OverviewTab tripId={tripId} onSwitchTab={setActiveTab} />
            </TabsContent>
            <TabsContent value="buses">
              <BusesTab tripId={tripId} />
            </TabsContent>
            <TabsContent value="rooms">
              <RoomsTab tripId={tripId} />
            </TabsContent>
            <TabsContent value="cars">
              <CarsTab tripId={tripId} />
            </TabsContent>
            <TabsContent value="unbooked">
              <UnbookedTab tripId={tripId} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
