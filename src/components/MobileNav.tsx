"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n/useTranslation";
import {
  Home,
  CalendarDays,
  FileText,
  Users,
  Archive,
  Settings,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/types/database";

interface MobileNavProps {
  profile: Profile;
}

const iconMap = {
  home: Home,
  trips: CalendarDays,
  reports: FileText,
  users: Users,
  logs: Activity,
  sectors: Archive,
  settings: Settings,
} as const;

type IconKey = keyof typeof iconMap;

export default function MobileNav({ profile }: MobileNavProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();

  const isAdmin = profile.role === "admin" || profile.role === "super_admin";

  const patientTabs = [
    { key: "trips", label: t("trips.title"), href: "/trips", icon: "trips" as const },
    { key: "settings", label: t("settings.title"), href: "/settings", icon: "settings" as const },
  ];

  const adminTabs = [
    { key: "home", label: t("admin.dashboard"), href: "/admin", icon: "home" as const },
    { key: "adminTrips", label: t("admin.trips"), href: "/admin/trips", icon: "trips" as const },
    { key: "myTrips", label: t("trips.myBookings"), href: "/trips", icon: "trips" as const },
    { key: "reports", label: t("admin.reports"), href: "/admin/reports", icon: "reports" as const },
  ];

  const adminExtraTabs = [
    { key: "users", label: t("admin.users"), href: "/admin/users", icon: "users" as const },
    { key: "sectors", label: t("admin.sectors"), href: "/admin/sectors", icon: "sectors" as const },
    { key: "settings", label: t("settings.title"), href: "/settings", icon: "settings" as const },
  ];

  const superAdminTabs = [
    { key: "logs", label: t("admin.activityLogs"), href: "/admin/logs", icon: "logs" as const },
  ];

  const tabs = isAdmin
    ? [
        ...adminTabs,
        ...(profile.role === "super_admin" || profile.role === "admin" ? adminExtraTabs : []),
        ...(profile.role === "super_admin" ? superAdminTabs : []),
      ]
    : patientTabs;

  function isActive(href: string): boolean {
    if (href === "/admin") return pathname === "/admin";
    if (href === "/trips") return pathname === "/trips" || (pathname.startsWith("/trips/") && !pathname.startsWith("/admin/trips"));
    if (href === "/settings") return pathname === "/settings";
    return pathname.startsWith(href);
  }

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-slate-200/60 dark:border-gray-800/60 md:hidden shadow-[0_-2px_10px_rgba(0,0,0,0.04)] dark:shadow-[0_-2px_10px_rgba(0,0,0,0.2)] safe-area-bottom">
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const active = isActive(tab.href);
          const Icon = iconMap[tab.icon as IconKey];
          return (
            <button
              key={tab.key}
              onClick={() => router.push(tab.href)}
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors duration-200",
                active
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-slate-400 dark:text-gray-500"
              )}
            >
              <Icon
                className="w-5 h-5"
                strokeWidth={active ? 2.5 : 2}
                fill={active ? "currentColor" : "none"}
              />
              <span className="text-[10px] font-medium leading-tight">{tab.label}</span>
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-blue-600 dark:bg-blue-400" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
