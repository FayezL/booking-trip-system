"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { TripStats } from "@/lib/types/database";

export default function AdminDashboard() {
  const { t, lang } = useTranslation();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [stats, setStats] = useState<TripStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("get_all_trips_stats");
      if (error) {
        console.error("[admin/dashboard] Failed:", error.message);
        return;
      }
      setStats((data || []) as TripStats[]);
    } catch {
      console.error("[admin/dashboard] Unexpected error");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

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

  if (loading) {
    return <LoadingSpinner text={t("common.loading")} />;
  }

  const roleBadges = [
    { key: "patient", label: t("admin.patient"), bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-400" },
    { key: "servant", label: t("admin.servant"), bg: "bg-green-50 dark:bg-green-950/30", text: "text-green-700 dark:text-green-400" },
    { key: "companion", label: t("admin.companion"), bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-400" },
    { key: "family_assistant", label: t("admin.familyAssistant"), bg: "bg-purple-50 dark:bg-purple-950/30", text: "text-purple-700 dark:text-purple-400" },
    { key: "trainee", label: t("admin.trainee"), bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-700 dark:text-orange-400" },
  ];

  function getStatusColor(percent: number) {
    if (percent >= 80) return "danger";
    if (percent >= 50) return "warning";
    return "";
  }

  function renderStatBox(label: string, value: string | number, bg: string, textColor: string) {
    return (
      <div className={`${bg} rounded-2xl p-4 text-center`}>
        <div className={`text-2xl font-bold ${textColor}`}>{value}</div>
        <div className="text-xs text-slate-400 dark:text-gray-500 mt-1">{label}</div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h1 className="section-title mb-6">{t("admin.dashboard")}</h1>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-6">
        {renderStatBox(t("admin.openTrips"), totals.openTrips, "bg-green-50 dark:bg-green-950/30", "text-green-700 dark:text-green-400")}
        {renderStatBox(t("admin.totalBookings"), totals.totalBookings, "bg-blue-50 dark:bg-blue-950/30", "text-blue-700 dark:text-blue-400")}
        {renderStatBox(t("admin.totalWheelchairs"), totals.totalWheelchairs, "bg-amber-50 dark:bg-amber-950/30", "text-amber-700 dark:text-amber-400")}
        {renderStatBox(t("admin.totalFamilyMembers"), totals.totalFamily, "bg-purple-50 dark:bg-purple-950/30", "text-purple-700 dark:text-purple-400")}
      </div>

      {stats.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-lg text-slate-400 dark:text-gray-500">{t("admin.noBusesYet")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {stats.map((s) => {
            const isExpanded = expandedId === s.trip_id;
            const title = lang === "ar" ? s.title_ar : s.title_en;
            const unbooked = s.total_registered - s.total_booked;

            return (
              <div key={s.trip_id} className="card">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : s.trip_id)}
                  className="w-full text-start flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-800 dark:text-gray-100">{title}</h2>
                      {s.is_open ? (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400">{t("admin.isOpen")}</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400">{t("admin.isClosed")}</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-400 dark:text-gray-500 mt-1">{s.trip_date}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">{s.total_booked}/{s.total_registered}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-gray-800 animate-slide-up">
                    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-4">
                      {renderStatBox(t("admin.totalBooked"), s.total_booked, "bg-blue-50 dark:bg-blue-950/30", "text-blue-700 dark:text-blue-400")}
                      {renderStatBox(t("admin.unbookedCount"), unbooked, "bg-red-50 dark:bg-red-950/30", "text-red-600 dark:text-red-400")}
                      {renderStatBox(t("admin.busSeatsFilled"), `${s.bus_stats.filled}/${s.bus_stats.total_seats}`, "bg-slate-50 dark:bg-gray-800", "text-slate-700 dark:text-gray-300")}
                      {renderStatBox(t("admin.roomsAssigned"), `${s.room_stats.assigned}/${s.room_stats.total_capacity}`, "bg-purple-50 dark:bg-purple-950/30", "text-purple-700 dark:text-purple-400")}
                    </div>

                    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 mb-4">
                      <div className="bg-slate-50 dark:bg-gray-800/50 rounded-2xl p-4">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300 mb-3">{t("admin.byRole")}</h3>
                        <div className="flex flex-wrap gap-2">
                          {roleBadges.map((rb) => {
                            const count = s.by_role[rb.key] || 0;
                            if (count === 0) return null;
                            return (
                              <span key={rb.key} className={`text-xs px-2.5 py-1 rounded-full font-medium ${rb.bg} ${rb.text}`}>
                                {rb.label}: {count}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      <div className="bg-slate-50 dark:bg-gray-800/50 rounded-2xl p-4">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300 mb-3">{t("admin.byGender")}</h3>
                        <div className="flex gap-3">
                          <span className="text-sm px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 font-medium">&#9794; {t("admin.maleCount")}: {s.by_gender.Male}</span>
                          <span className="text-sm px-3 py-1 rounded-full bg-pink-50 dark:bg-pink-950/30 text-pink-700 dark:text-pink-400 font-medium">&#9792; {t("admin.femaleCount")}: {s.by_gender.Female}</span>
                        </div>
                        <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300 mt-4 mb-3">&#9855; {t("admin.wheelchair")}</h3>
                        <div className="flex gap-3">
                          <span className="text-sm px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 font-medium">{t("admin.withWheelchair")}: {s.wheelchair_count}</span>
                          <span className="text-sm px-3 py-1 rounded-full bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-400 font-medium">{t("admin.withoutWheelchair")}: {s.total_booked - s.wheelchair_count}</span>
                        </div>
                      </div>

                      <div className="bg-slate-50 dark:bg-gray-800/50 rounded-2xl p-4">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300 mb-3">{t("admin.transportBreakdown")}</h3>
                        <div className="flex flex-wrap gap-2">
                          <span className="text-sm px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 font-medium">{t("admin.onBus")}: {s.transport_breakdown.on_bus}</span>
                          <span className="text-sm px-3 py-1 rounded-full bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 font-medium">{t("admin.inCar")}: {s.transport_breakdown.in_car}</span>
                          <span className="text-sm px-3 py-1 rounded-full bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-400 font-medium">{t("admin.noTransport")}: {s.transport_breakdown.no_transport}</span>
                        </div>
                      </div>

                      <div className="bg-slate-50 dark:bg-gray-800/50 rounded-2xl p-4">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300 mb-3">{t("admin.servantsNeededCount")}</h3>
                        <div className="flex gap-2">
                          <span className="text-sm px-3 py-1 rounded-full bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-400 font-medium">0: {s.servants_needed["0"] || 0}</span>
                          <span className="text-sm px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 font-medium">1: {s.servants_needed["1"] || 0}</span>
                          <span className="text-sm px-3 py-1 rounded-full bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 font-medium">2: {s.servants_needed["2"] || 0}</span>
                        </div>
                        <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300 mt-4 mb-3">{t("admin.familyMembersCount")}</h3>
                        <p className="text-sm text-slate-600 dark:text-gray-400 font-medium">{s.family_members_count}</p>
                      </div>
                    </div>

                    {s.by_sector.length > 0 && (
                      <div className="bg-slate-50 dark:bg-gray-800/50 rounded-2xl p-4 mb-4">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300 mb-3">{t("admin.bySector")}</h3>
                        <div className="flex flex-wrap gap-2">
                          {s.by_sector.map((sec) => (
                            <span key={sec.name} className="text-xs px-2.5 py-1 rounded-full font-medium bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-400">
                              {sec.name}: {sec.count}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {s.bus_stats.total_seats > 0 && (
                      <div className="mb-4">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300 mb-3">{t("admin.fillRate")}</h3>
                        <div className="flex items-center gap-3">
                          <div className="progress-bar flex-1">
                            <div
                              className={`progress-bar-fill ${getStatusColor(s.bus_stats.filled / s.bus_stats.total_seats * 100)}`}
                              style={{ width: `${Math.min(s.bus_stats.filled / s.bus_stats.total_seats * 100, 100)}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold text-slate-600 dark:text-gray-400 shrink-0">
                            {s.bus_stats.filled}/{s.bus_stats.total_seats} ({Math.round(s.bus_stats.filled / s.bus_stats.total_seats * 100)}%)
                          </span>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => router.push(`/admin/trips/${s.trip_id}`)}
                      className="btn-primary w-full sm:w-auto"
                    >
                      {t("admin.manage")} &#8594;
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
