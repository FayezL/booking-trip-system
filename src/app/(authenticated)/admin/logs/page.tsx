"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import PageBreadcrumbs from "@/components/PageBreadcrumbs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollText, Filter } from "lucide-react";
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

function getActionBadgeVariant(action: string) {
  if (action.startsWith("create") || action === "register_patient" || action === "book_user")
    return "default";
  if (action.startsWith("edit") || action === "toggle_trip" || action === "assign_room" || action === "change_role")
    return "secondary";
  if (action.startsWith("delete") || action === "cancel_booking")
    return "destructive";
  return "outline";
}

export default function LogsPage() {
  const { t, lang } = useTranslation();
  const supabase = useMemo(() => createClient(), []);

  const [logs, setLogs] = useState<LogWithAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState<string>("");
  const [page, setPage] = useState(1);

  const PAGE_SIZE = 30;

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    const { data, error } = await query;
    if (error) {
      console.error("[admin/logs] Failed to load logs:", error.message);
    }
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
    return (
      <div className="animate-fade-in space-y-6">
        <PageBreadcrumbs
          items={[
            { label: t("admin.dashboard"), href: "/admin" },
            { label: t("admin.activityLogs") },
          ]}
        />
        <div className="flex items-center gap-2">
          <ScrollText className="size-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold">{t("admin.activityLogs")}</h1>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <PageBreadcrumbs
        items={[
          { label: t("admin.dashboard"), href: "/admin" },
          { label: t("admin.activityLogs") },
        ]}
      />

      <div className="flex items-center gap-2">
        <ScrollText className="size-5 text-muted-foreground" />
        <h1 className="text-xl font-semibold">{t("admin.activityLogs")}</h1>
      </div>

      <div className="flex items-center gap-2">
        <Filter className="size-4 text-muted-foreground" />
        <Select
          value={actionFilter || null}
          onValueChange={(val) => setActionFilter(val ?? "")}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder={t("admin.filterByAction")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">
              {t("admin.filterByAction")}
            </SelectItem>
            {ACTION_TYPES.map((a) => (
              <SelectItem key={a} value={a}>
                {t(`admin.${ACTION_LABELS[a]}`)} ({a})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("admin.timestamp")}</TableHead>
            <TableHead>{t("admin.admin")}</TableHead>
            <TableHead>{t("admin.action")}</TableHead>
            <TableHead>{t("admin.targetType")}</TableHead>
            <TableHead>{t("admin.targetId")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginated.map((log) => (
            <TableRow key={log.id}>
              <TableCell className="text-xs text-muted-foreground" dir="ltr">
                {formatTimestamp(log.created_at)}
              </TableCell>
              <TableCell className="font-medium text-sm">
                {log.profiles?.full_name || "—"}
              </TableCell>
              <TableCell>
                <Badge variant={getActionBadgeVariant(log.action)}>
                  {t(`admin.${ACTION_LABELS[log.action] || "action"}`)}
                </Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {log.target_type || "—"}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground font-mono">
                {log.target_id ? log.target_id.slice(0, 8) + "..." : "—"}
              </TableCell>
            </TableRow>
          ))}
          {logs.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                {t("admin.noLogs")}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            ←
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            →
          </Button>
        </div>
      )}
    </div>
  );
}
