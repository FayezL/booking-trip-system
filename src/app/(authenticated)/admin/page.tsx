"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useToast } from "@/components/Toast";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Users,
  Bus,
  Bed,
  Car,
  BarChart3,
  ChevronDown,
  CalendarDays,
  Accessibility,
  UsersRound,
} from "lucide-react";
import type { TripStats } from "@/lib/types/database";

function getStatusColor(percent: number) {
  if (percent >= 80) return "danger";
  if (percent >= 50) return "warning";
  return "";
}

export default function AdminDashboard() {
  const { t, lang } = useTranslation();
  const { showToast } = useToast();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [stats, setStats] = useState<TripStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("get_all_trips_stats");
      if (error) {
        console.error("[admin/dashboard] RPC failed:", error);
        showToast(`${t("common.error")}: ${error.message}`, "error");
        return;
      }
      setStats((data || []) as TripStats[]);
    } catch (err) {
      console.error("[admin/dashboard] Unexpected error:", err);
      showToast(t("common.error"), "error");
    } finally {
      setLoading(false);
    }
  }, [supabase, showToast, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totals = useMemo(() => {
    let totalBookings = 0;
    let totalWheelchairs = 0;
    let totalFamily = 0;
    let openTrips = 0;
    for (const s of stats) {
      totalBookings += s.total_booked;
      totalWheelchairs += s.wheelchair_count;
      totalFamily += s.family_members_count;
      if (s.is_open) openTrips++;
    }
    return { totalBookings, totalWheelchairs, totalFamily, openTrips, closedTrips: stats.length - openTrips };
  }, [stats]);

  const roleBadges = useMemo(() => [
    { key: "patient", label: t("admin.patient"), variant: "default" as const },
    { key: "servant", label: t("admin.servant"), variant: "success" as const },
    { key: "companion", label: t("admin.companion"), variant: "warning" as const },
    { key: "family_assistant", label: t("admin.familyAssistant"), variant: "purple" as const },
    { key: "trainee", label: t("admin.trainee"), variant: "orange" as const },
  ], [t]);

  if (loading) {
    return <LoadingSpinner text={t("common.loading")} />;
  }

  return (
    <div className="animate-fade-in space-y-6">
      <h1 className="section-title">{t("admin.dashboard")}</h1>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="border-green-200/60 dark:border-green-900/40">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-green-50 dark:bg-green-950/30">
              <CalendarDays className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-green-700 dark:text-green-400">{totals.openTrips}</div>
              <div className="text-xs text-slate-400 dark:text-gray-500">{t("admin.openTrips")}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200/60 dark:border-blue-900/40">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/30">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">{totals.totalBookings}</div>
              <div className="text-xs text-slate-400 dark:text-gray-500">{t("admin.totalBookings")}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200/60 dark:border-amber-900/40">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/30">
              <Accessibility className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{totals.totalWheelchairs}</div>
              <div className="text-xs text-slate-400 dark:text-gray-500">{t("admin.totalWheelchairs")}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-200/60 dark:border-purple-900/40">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/30">
              <UsersRound className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">{totals.totalFamily}</div>
              <div className="text-xs text-slate-400 dark:text-gray-500">{t("admin.totalFamilyMembers")}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {stats.length === 0 ? (
        <div className="text-center py-16">
          <BarChart3 className="w-12 h-12 mx-auto text-slate-300 dark:text-gray-600 mb-3" />
          <p className="text-lg text-slate-400 dark:text-gray-500">{t("trips.noTrips")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {stats.map((s) => {
            const isExpanded = expandedId === s.trip_id;
            const title = lang === "ar" ? s.title_ar : s.title_en;
            const unbooked = s.total_registered - s.total_booked;

            return (
              <Card key={s.trip_id} className="overflow-hidden">
                <CardHeader
                  className="cursor-pointer select-none"
                  onClick={() => setExpandedId(isExpanded ? null : s.trip_id)}
                  aria-expanded={isExpanded}
                  aria-controls={`trip-details-${s.trip_id}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                        <Bus className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">{title}</CardTitle>
                          {s.is_open ? (
                            <Badge variant="success">{t("admin.isOpen")}</Badge>
                          ) : (
                            <Badge variant="destructive">{t("admin.isClosed")}</Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-400 dark:text-gray-500 mt-0.5">{s.trip_date}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="default">{s.total_booked}/{s.total_registered}</Badge>
                      <ChevronDown
                        className={cn(
                          "w-5 h-5 text-slate-400 transition-transform duration-300",
                          isExpanded && "rotate-180"
                        )}
                      />
                    </div>
                  </div>
                </CardHeader>

                <div
                  id={`trip-details-${s.trip_id}`}
                  className={cn(
                    "overflow-hidden transition-all duration-300 ease-in-out",
                    isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
                  )}
                >
                  <CardContent className="border-t border-slate-100 dark:border-gray-800">
                    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-4">
                      <div className="flex items-center gap-2 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 p-3">
                        <Users className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                        <div>
                          <div className="text-lg font-bold text-blue-700 dark:text-blue-400">{s.total_booked}</div>
                          <div className="text-[11px] text-slate-400 dark:text-gray-500">{t("admin.totalBooked")}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 rounded-xl bg-red-50/60 dark:bg-red-950/20 p-3">
                        <Users className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0" />
                        <div>
                          <div className="text-lg font-bold text-red-600 dark:text-red-400">{unbooked}</div>
                          <div className="text-[11px] text-slate-400 dark:text-gray-500">{t("admin.unbookedCount")}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 rounded-xl bg-slate-50/60 dark:bg-gray-800/40 p-3">
                        <Bus className="w-4 h-4 text-slate-600 dark:text-gray-300 shrink-0" />
                        <div>
                          <div className="text-lg font-bold text-slate-700 dark:text-gray-300">{s.bus_stats.filled}/{s.bus_stats.total_seats}</div>
                          <div className="text-[11px] text-slate-400 dark:text-gray-500">{t("admin.busSeatsFilled")}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 rounded-xl bg-purple-50/60 dark:bg-purple-950/20 p-3">
                        <Bed className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                        <div>
                          <div className="text-lg font-bold text-purple-700 dark:text-purple-400">{s.room_stats.assigned}/{s.room_stats.total_capacity}</div>
                          <div className="text-[11px] text-slate-400 dark:text-gray-500">{t("admin.roomsAssigned")}</div>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 mb-4">
                      <Card className="border-0 bg-slate-50/70 dark:bg-gray-800/40">
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="text-sm">{t("admin.byRole")}</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                          <div className="flex flex-wrap gap-2">
                            {roleBadges.map((rb) => {
                              const count = s.by_role[rb.key] || 0;
                              if (count === 0) return null;
                              return (
                                <Badge key={rb.key} variant={rb.variant}>
                                  {rb.label}: {count}
                                </Badge>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-0 bg-slate-50/70 dark:bg-gray-800/40">
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="text-sm">{t("admin.byGender")}</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                          <div className="flex gap-3">
                            <Badge variant="default">&#9794; {t("admin.maleCount")}: {s.by_gender.Male}</Badge>
                            <Badge className="bg-pink-50 text-pink-700 dark:bg-pink-950/30 dark:text-pink-400">&#9792; {t("admin.femaleCount")}: {s.by_gender.Female}</Badge>
                          </div>
                          <CardTitle className="text-sm mt-4 mb-2">&#9855; {t("admin.wheelchair")}</CardTitle>
                          <div className="flex gap-3">
                            <Badge variant="warning">
                              <Accessibility className="w-3.5 h-3.5" />
                              {t("admin.withWheelchair")}: {s.wheelchair_count}
                            </Badge>
                            <Badge variant="secondary">{t("admin.withoutWheelchair")}: {s.total_booked - s.wheelchair_count}</Badge>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-0 bg-slate-50/70 dark:bg-gray-800/40">
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="text-sm">{t("admin.transportBreakdown")}</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="default">
                              <Bus className="w-3.5 h-3.5" />
                              {t("admin.onBus")}: {s.transport_breakdown.on_bus}
                            </Badge>
                            <Badge variant="success">
                              <Car className="w-3.5 h-3.5" />
                              {t("admin.inCar")}: {s.transport_breakdown.in_car}
                            </Badge>
                            <Badge variant="secondary">{t("admin.noTransport")}: {s.transport_breakdown.no_transport}</Badge>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-0 bg-slate-50/70 dark:bg-gray-800/40">
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="text-sm">{t("admin.servantsNeededCount")}</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                          <div className="flex gap-2">
                            <Badge variant="secondary">0: {s.servants_needed["0"] || 0}</Badge>
                            <Badge variant="warning">1: {s.servants_needed["1"] || 0}</Badge>
                            <Badge variant="destructive">2: {s.servants_needed["2"] || 0}</Badge>
                          </div>
                          <CardTitle className="text-sm mt-4 mb-2">{t("admin.familyMembersCount")}</CardTitle>
                          <p className="text-sm text-slate-600 dark:text-gray-400 font-medium">{s.family_members_count}</p>
                        </CardContent>
                      </Card>
                    </div>

                    {s.by_sector.length > 0 && (
                      <Card className="border-0 bg-slate-50/70 dark:bg-gray-800/40 mb-4">
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="text-sm">{t("admin.bySector")}</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                          <div className="flex flex-wrap gap-2">
                            {s.by_sector.map((sec) => (
                              <Badge key={sec.name} className="bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-400">
                                {sec.name}: {sec.count}
                              </Badge>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {s.bus_stats.total_seats > 0 && (() => {
                      const pct = Math.min(s.bus_stats.filled / s.bus_stats.total_seats * 100, 100);
                      return (
                        <div className="mb-4">
                          <CardTitle className="text-sm mb-3">{t("admin.fillRate")}</CardTitle>
                          <div className="flex items-center gap-3">
                            <div className="progress-bar flex-1" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
                              <div
                                className={`progress-bar-fill ${getStatusColor(pct)}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-sm font-semibold text-slate-600 dark:text-gray-400 shrink-0">
                              {s.bus_stats.filled}/{s.bus_stats.total_seats} ({Math.round(pct)}%)
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    <Button onClick={() => router.push(`/admin/trips/${s.trip_id}`)}>
                      {t("admin.manage")} &#8594;
                    </Button>
                  </CardContent>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
