"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { AdminLog } from "@/lib/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { FileText, Clock, User, ChevronLeft, ChevronRight } from "lucide-react";

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

function getActionBadgeVariant(action: string): "default" | "secondary" | "destructive" | "outline" {
  if (action.includes("create") || action.includes("book") || action.includes("register")) return "default";
  if (action.includes("delete") || action.includes("cancel")) return "destructive";
  if (action.includes("edit") || action.includes("toggle") || action.includes("assign")) return "secondary";
  return "outline";
}

function getActionBadgeClassName(action: string): string {
  if (action.includes("create") || action.includes("book") || action.includes("register")) {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 hover:bg-emerald-100";
  }
  if (action.includes("delete") || action.includes("cancel")) {
    return "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 hover:bg-red-100";
  }
  if (action.includes("edit") || action.includes("toggle") || action.includes("assign")) {
    return "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 hover:bg-blue-100";
  }
  return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-100";
}

export default function LogsPage() {
  const { t, lang } = useTranslation();
  const supabase = useMemo(() => createClient(), []);

  const [logs, setLogs] = useState<LogWithAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");
  const [page, setPage] = useState(1);

  const PAGE_SIZE = 30;

  const loadLogs = useCallback(async () => {
    try {
      let query = supabase
        .from("admin_logs")
        .select("*, profiles!admin_logs_admin_id_fkey(full_name)")
        .order("created_at", { ascending: false })
        .limit(500);

      if (actionFilter) {
        query = query.eq("action", actionFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setLogs((data || []) as unknown as LogWithAdmin[]);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
      setPage(1);
    }
  }, [actionFilter, supabase]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

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
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center gap-2">
        <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        <h1 className="section-title">{t("admin.activityLogs")}</h1>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Select value={actionFilter || "__all__"} onValueChange={(v) => setActionFilter(v === "__all__" ? "" : v)}>
              <SelectTrigger className="max-w-xs">
                <SelectValue placeholder={t("admin.filterByAction")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">— {t("admin.filterByAction")} —</SelectItem>
                {ACTION_TYPES.map((a) => (
                  <SelectItem key={a} value={a}>
                    {t(`admin.${ACTION_LABELS[a]}`)} ({a})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {paginated.map((log) => (
              <div key={log.id} className="flex flex-wrap items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <span className="text-xs text-muted-foreground flex items-center gap-1" dir="ltr">
                  <Clock className="h-3 w-3" />
                  {formatTimestamp(log.created_at)}
                </span>
                <span className="font-medium text-sm text-foreground flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {log.profiles?.full_name || "—"}
                </span>
                <Badge
                  variant={getActionBadgeVariant(log.action)}
                  className={cn("text-xs", getActionBadgeClassName(log.action))}
                >
                  {t(`admin.${ACTION_LABELS[log.action] || "action"}`)}
                </Badge>
                {log.target_type && (
                  <span className="text-xs text-muted-foreground">
                    {log.target_type}{log.target_id ? `: ${log.target_id.slice(0, 8)}...` : ""}
                  </span>
                )}
              </div>
            ))}
            {logs.length === 0 && (
              <p className="text-muted-foreground text-center py-4 text-sm">{t("admin.noLogs")}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
