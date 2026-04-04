"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { Profile } from "@/lib/types/database";

interface MobileNavProps {
  profile: Profile;
}

const icons = {
  home: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
    </svg>
  ),
  homeFilled: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={0}>
      <path d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 11-1.06 1.06l-.97-.97V19.5a.75.75 0 01-.75.75h-4.5a.75.75 0 01-.75-.75v-3.75h-3v3.75a.75.75 0 01-.75.75h-4.5a.75.75 0 01-.75-.75V12.62l-.97.97a.75.75 0 01-1.06-1.06l8.69-8.69z" />
    </svg>
  ),
  trips: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  tripsFilled: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v14a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h12a1 1 0 100-2H6z" clipRule="evenodd" />
    </svg>
  ),
  reports: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  reportsFilled: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
    </svg>
  ),
  users: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  usersFilled: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
      <path d="M9 6a3 3 0 106 0 3 3 0 00-6 0zM17 18a1 1 0 01-1 1H4a1 1 0 01-1-1v-1a5 5 0 0110 0v1zm5-1a1 1 0 01-1 1h-2.5a1 1 0 01-1-1v-1a5 5 0 00-2.2-4.16A3.5 3.5 0 0122 14.5v2.5z" />
    </svg>
  ),
  logs: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  ),
  logsFilled: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
      <path d="M4 4a2 2 0 012-2h12a2 2 0 012 2v16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
    </svg>
  ),
};

type IconKey = keyof typeof icons;

function getActiveIcon(key: string): IconKey {
  return (key + "Filled") as IconKey;
}

export default function MobileNav({ profile }: MobileNavProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();

  const isAdmin = profile.role === "servant" || profile.role === "super_admin";

  const patientTabs = [
    { key: "trips", label: t("trips.title"), href: "/trips", icon: "trips" as const },
  ];

  const adminTabs = [
    { key: "home", label: t("admin.dashboard"), href: "/admin", icon: "home" as const },
    { key: "trips", label: t("admin.trips"), href: "/admin/trips", icon: "trips" as const },
    { key: "reports", label: t("admin.reports"), href: "/admin/reports", icon: "reports" as const },
  ];

  const superAdminTabs = [
    { key: "users", label: t("admin.users"), href: "/admin/users", icon: "users" as const },
    { key: "logs", label: t("admin.activityLogs"), href: "/admin/logs", icon: "logs" as const },
  ];

  const tabs = isAdmin
    ? profile.role === "super_admin"
      ? [...adminTabs, ...superAdminTabs]
      : adminTabs
    : patientTabs;

  function isActive(href: string): boolean {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  }

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200 md:hidden safe-area-bottom">
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const active = isActive(tab.href);
          return (
            <button
              key={tab.key}
              onClick={() => router.push(tab.href)}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors duration-150 ${
                active ? "text-blue-600" : "text-slate-400"
              }`}
            >
              {active ? icons[getActiveIcon(tab.icon)] : icons[tab.icon]}
              <span className="text-[10px] font-medium leading-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
