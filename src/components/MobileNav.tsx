"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Map,
  Ticket,
  FileText,
  Users,
  ScrollText,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { Profile } from "@/lib/types/database";
import type { LucideIcon } from "lucide-react";

interface NavTab {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  roles?: Profile["role"][];
}

const navTabs: NavTab[] = [
  { href: "/admin", labelKey: "admin.dashboard", icon: LayoutDashboard, roles: ["super_admin", "admin", "servant"] },
  { href: "/admin/trips", labelKey: "admin.trips", icon: Map, roles: ["super_admin", "admin", "servant"] },
  { href: "/trips", labelKey: "trips.myBookings", icon: Ticket },
  { href: "/admin/reports", labelKey: "admin.reports", icon: FileText, roles: ["super_admin", "admin", "servant"] },
  { href: "/admin/users", labelKey: "admin.users", icon: Users, roles: ["super_admin", "admin"] },
  { href: "/admin/logs", labelKey: "admin.activityLogs", icon: ScrollText, roles: ["super_admin"] },
];

interface MobileNavProps {
  profile: Profile;
}

export default function MobileNav({ profile }: MobileNavProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();

  const isAdmin = profile.role === "admin" || profile.role === "super_admin" || profile.role === "servant";

  const tabs = navTabs.filter((tab) => {
    if (!isAdmin && tab.href.startsWith("/admin")) return false;
    if (tab.roles && !tab.roles.includes(profile.role)) return false;
    return true;
  });

  function isActive(href: string): boolean {
    if (href === "/admin") return pathname === "/admin";
    if (href === "/trips") return pathname === "/trips" || (pathname.startsWith("/trips/") && !pathname.startsWith("/admin/trips"));
    return pathname.startsWith(href);
  }

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-background/80 backdrop-blur-lg border-t md:hidden safe-area-bottom">
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab.href);
          return (
            <button
              key={tab.href}
              onClick={() => router.push(tab.href)}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
                active
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
            >
              <Icon className={`size-5 ${active ? "text-primary" : ""}`} />
              <span className="text-[10px] font-medium leading-tight">{t(tab.labelKey)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
