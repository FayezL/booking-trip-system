"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { AdminLog } from "@/lib/types/database";

type LogWithAdmin = AdminLog & { profiles: { full_name: string } };

const ACTION_LABELS: Record<string, string> = {
  login: "loginAction",
  logout: "logoutAction",
  create_trip: "createAction",
  edit_trip: "editAction",
  delete_trip: "deleteAction",
  toggle_trip: "editAction",
  create_bus: "createAction",
  edit_bus: "editAction",
  delete_bus: "deleteAction",
  create_room: "createAction",
  edit_room: "editAction",
  delete_room: "deleteAction",
  book_user: "bookAction",
  cancel_booking: "deleteAction",
  assign_room: "editAction",
  register_patient: "createAction",
  reset_password: "resetPasswordAction",
  change_role: "changeRoleAction",
};

const ACTION_TYPES = Object.keys(ACTION_LABELS);

export default function LogsPage() {
  const { t, lang } = useTranslation();
  const supabase = createClient();

  const [logs, setLogs] = useState<LogWithAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");
  const [page, setPage] = useState(1);

  const PAGE_SIZE = 30;

  useEffect(() => {
    loadLogs();
  }, [actionFilter]);

  async function loadLogs() {
    let query = supabase
      .from("admin_logs")
      .select("*, profiles!admin_logs_admin_id_fkey(full_name)")
      .order("created_at", { ascending: false })
      .limit(500);

    if (actionFilter) {
      query = query.eq("action", actionFilter);
    }

    const { data } = await query;
    setLogs((data || []) as unknown as LogWithAdmin[]);
    setLoading(false);
    setPage(1);
  }

  const totalPages = Math.ceil(logs.length / PAGE_SIZE);
  const paginated = logs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function formatTimestamp(ts: string) {
    return new Date(ts).toLocaleString(lang === "ar" ? "ar-EG" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (loading) {
    return <LoadingSpinner text={t("common.loading")} />;
  }

  return (
    <div className="animate-fade-in">
      <h1 className="section-title mb-6">{t("admin.activityLogs")}</h1>

      <div className="mb-4">
        <select
          className="input-field max-w-xs"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
        >
          <option value="">— {t("admin.filterByAction")} —</option>
          {ACTION_TYPES.map((a) => (
            <option key={a} value={a}>
              {t(`admin.${ACTION_LABELS[a]}`)} ({a})
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        {paginated.map((log) => (
          <div key={log.id} className="card">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400 dark:text-gray-500" dir="ltr">
                {formatTimestamp(log.created_at)}
              </span>
              <span className="font-medium text-sm text-slate-700 dark:text-gray-300">
                {log.profiles?.full_name || "—"}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 font-medium">
                {t(`admin.${ACTION_LABELS[log.action] || "action"}`)}
              </span>
              {log.target_type && (
                <span className="text-xs text-slate-400 dark:text-gray-500">
                  {log.target_type}{log.target_id ? `: ${log.target_id.slice(0, 8)}...` : ""}
                </span>
              )}
            </div>
          </div>
        ))}
        {logs.length === 0 && (
          <p className="text-slate-400 dark:text-gray-500 text-center py-4 text-sm">{t("admin.noLogs")}</p>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-50 dark:bg-gray-800 hover:bg-slate-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-all duration-150"
            >
              ←
            </button>
            <span className="text-sm text-slate-500 dark:text-gray-400">{page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-50 dark:bg-gray-800 hover:bg-slate-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-all duration-150"
            >
              →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
