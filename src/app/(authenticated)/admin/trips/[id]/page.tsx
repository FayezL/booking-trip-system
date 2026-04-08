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
import PageBreadcrumbs from "@/components/PageBreadcrumbs";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
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
    return <p className="text-center py-20 text-muted-foreground">{t("common.error")}</p>;
  }

  const tripTitle = lang === "ar" ? trip.title_ar : trip.title_en;

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: t("admin.overview") },
    { key: "buses", label: t("admin.buses") },
    { key: "rooms", label: t("admin.rooms") },
    { key: "unbooked", label: t("admin.unbooked") },
  ];

  return (
    <div className="animate-fade-in">
      <PageBreadcrumbs
        items={[
          { label: t("admin.dashboard"), href: "/admin" },
          { label: t("admin.trips"), href: "/admin/trips" },
          { label: tripTitle },
        ]}
      />

      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/admin/trips")}
        className="mt-3 mb-1"
      >
        <ArrowRight className="rtl:rotate-180" />
        {t("admin.backToTrips")}
      </Button>

      <h1 className="section-title mb-1">{tripTitle}</h1>
      <p className="text-muted-foreground mb-4 text-sm">{trip.trip_date}</p>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Tab)}>
        <TabsList variant="line" className="mb-6 w-full justify-start overflow-x-auto">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key}>
              {tab.label}
            </TabsTrigger>
          ))}
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
        <TabsContent value="unbooked">
          <UnbookedTab tripId={tripId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
