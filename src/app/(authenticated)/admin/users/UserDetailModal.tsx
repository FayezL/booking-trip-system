"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { UserDetail } from "@/lib/types/database";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { User, Phone, Shield, Bus, Car, Users, MapPin } from "lucide-react";

interface UserDetailModalProps {
  userId: string;
  onClose: () => void;
}

function getRoleLabel(role: string, t: (key: string) => string): string {
  switch (role) {
    case "super_admin": return t("admin.superAdmin");
    case "admin": return t("admin.adminRole");
    case "servant": return t("admin.servant");
    case "patient": return t("admin.patient");
    case "companion": return t("admin.companion");
    case "family_assistant": return t("admin.familyAssistant");
    case "trainee": return t("admin.trainee");
    default: return role;
  }
}

function getRoleBadgeClassName(role: string): string {
  switch (role) {
    case "super_admin": return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 hover:bg-amber-100";
    case "admin": return "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 hover:bg-blue-100";
    case "servant": return "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 hover:bg-indigo-100";
    case "patient": return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-100";
    case "companion": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 hover:bg-emerald-100";
    case "family_assistant": return "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 hover:bg-purple-100";
    case "trainee": return "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400 hover:bg-orange-100";
    default: return "";
  }
}

function getInitials(name: string): string {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export default function UserDetailModal({ userId, onClose }: UserDetailModalProps) {
  const { t } = useTranslation();
  const supabase = createClient();
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDetail = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("admin_get_user_details", {
        p_user_id: userId,
      });
      if (error) throw error;
      if (data && Array.isArray(data) && data.length > 0) {
        setDetail(data[0] as unknown as UserDetail);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [userId, supabase]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("admin.userDetails")}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-muted-foreground text-center py-8">{t("common.loading")}</p>
        ) : detail ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-lg font-semibold bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400">
                  {getInitials(detail.full_name)}
                </AvatarFallback>
              </Avatar>
              <h3 className="text-lg font-bold text-foreground">{detail.full_name}</h3>
              <div className="flex gap-2">
                <Badge className={cn("text-xs", getRoleBadgeClassName(detail.role))}>
                  <Shield className="h-3 w-3 me-1" />
                  {getRoleLabel(detail.role, t)}
                </Badge>
                <Badge variant="outline" className={cn(
                  "text-xs",
                  detail.gender === "Male"
                    ? "border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400"
                    : "border-pink-300 text-pink-600 dark:border-pink-700 dark:text-pink-400"
                )}>
                  {detail.gender === "Male" ? t("auth.male") : t("auth.female")}
                </Badge>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex justify-between items-center gap-4">
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  {t("auth.phone")}
                </span>
                <span className="text-sm font-medium text-foreground" dir="ltr">{detail.phone}</span>
              </div>

              <div className="flex justify-between items-center gap-4">
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  {t("admin.wheelchair")}
                </span>
                <span className="text-sm font-medium text-foreground">{detail.has_wheelchair ? t("common.yes") : t("common.no")}</span>
              </div>

              <Separator />

              <div className="flex justify-between items-center gap-4">
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Bus className="h-3.5 w-3.5" />
                  {t("admin.transportType")}
                </span>
                <Badge variant="outline" className="text-xs">
                  {detail.transport_type === "private" ? t("admin.transportPrivate") : t("admin.transportBus")}
                </Badge>
              </div>

              <div className="flex justify-between items-center gap-4">
                <span className="text-sm text-muted-foreground">{t("admin.servantsNeeded")}</span>
                <Badge variant="secondary" className="text-xs">{detail.servants_needed}</Badge>
              </div>

              <Separator />

              <div className="flex justify-between items-center gap-4">
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {t("sectors.title")}
                </span>
                <span className="text-sm font-medium text-foreground">{detail.sector_name || t("sectors.none")}</span>
              </div>

              {detail.role === "servant" && detail.has_car && (
                <>
                  <Separator />
                  <div className="flex justify-between items-center gap-4">
                    <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <Car className="h-3.5 w-3.5" />
                      {t("cars.title")}
                    </span>
                    <Badge variant="outline" className="text-xs gap-1">
                      <Users className="h-3 w-3" />
                      {detail.car_seats || 0} {t("cars.seats")}
                    </Badge>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">{t("common.error")}</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="w-full">
            {t("common.cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
