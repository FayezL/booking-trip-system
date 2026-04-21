"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { UserDetail } from "@/lib/types/database";

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
      // silently fail — modal just shows loading
    } finally {
      setLoading(false);
    }
  }, [userId, supabase]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const fields: { label: string; value: string }[] = detail
    ? [
        { label: t("auth.fullName"), value: detail.full_name },
        { label: t("auth.phone"), value: detail.phone },
        { label: t("auth.gender"), value: detail.gender === "Male" ? t("auth.male") : t("auth.female") },
        { label: t("admin.role"), value: getRoleLabel(detail.role, t) },
        { label: t("admin.wheelchair"), value: detail.has_wheelchair ? t("common.yes") : t("common.no") },
        { label: t("admin.transportType"), value: detail.transport_type === "private" ? t("admin.transportPrivate") : t("admin.transportBus") },
        { label: t("admin.servantsNeeded"), value: String(detail.servants_needed) },
        { label: t("sectors.title"), value: detail.sector_name || t("sectors.none") },
        ...(detail.role === "servant" && detail.has_car
          ? [
              { label: t("cars.title"), value: `${t("settings.hasCar")} (${detail.car_seats || 0} ${t("cars.seats")})` },
            ]
          : []),
      ]
    : [];

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full p-6 animate-slide-up shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-800 dark:text-gray-100">{t("admin.userDetails")}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 dark:text-gray-500 hover:bg-slate-100 dark:hover:bg-gray-800 active:scale-95 transition-all duration-150"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <p className="text-slate-400 dark:text-gray-500 text-center py-8">{t("common.loading")}</p>
        ) : detail ? (
          <div className="space-y-3">
            {fields.map((field) => (
              <div key={field.label} className="flex justify-between items-center gap-4">
                <span className="text-sm text-slate-500 dark:text-gray-400 shrink-0">{field.label}</span>
                <span className="text-sm font-medium text-slate-800 dark:text-gray-100 text-end">{field.value}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-400 dark:text-gray-500 text-center py-8">{t("common.error")}</p>
        )}

        <button
          onClick={onClose}
          className="btn-secondary w-full mt-6"
        >
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}
