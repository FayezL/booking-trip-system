"use client";

import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import LanguageToggle from "./LanguageToggle";
import ThemeToggle from "./ThemeToggle";
import type { Profile } from "@/lib/types/database";

interface HeaderProps {
  profile: Profile;
}

export default function Header({ profile }: HeaderProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const isAdmin = profile.role === "admin" || profile.role === "super_admin";

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  function isActive(href: string): boolean {
    if (href === "/admin") return pathname === "/admin";
    if (href === "/trips") return pathname === "/trips";
    return pathname.startsWith(href);
  }

  const navItems = [
    ...(isAdmin
      ? [
          { href: "/admin", label: t("admin.dashboard") },
          { href: "/admin/trips", label: t("admin.trips") },
          { href: "/trips", label: t("trips.myBookings") },
          { href: "/admin/reports", label: t("admin.reports") },
          ...(profile.role === "super_admin" || profile.role === "admin"
            ? [
                { href: "/admin/users", label: t("admin.users") },
                { href: "/admin/sectors", label: t("admin.sectors") },
              ]
            : []),
          ...(profile.role === "super_admin"
            ? [
                { href: "/admin/logs", label: t("admin.activityLogs") },
              ]
            : []),
        ]
      : []),
  ];

  return (
    <header className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-slate-200/60 dark:border-gray-800/60 sticky top-0 z-50 shadow-sm shadow-slate-200/40 dark:shadow-gray-950/40">
      <div className="md:hidden px-4 py-2.5 flex items-center justify-between">
        <h1
          className="text-lg font-bold text-blue-700 dark:text-blue-400 cursor-pointer transition-colors duration-200 hover:text-blue-800 dark:hover:text-blue-300"
          onClick={() => router.push(isAdmin ? "/admin" : "/trips")}
        >
          Saint Demiana | القديسة ديمانه
        </h1>
        <div className="flex items-center gap-1.5">
          <LanguageToggle />
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/settings")}
            className="text-slate-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400"
            title={t("settings.title")}
          >
            <Settings className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="text-slate-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400"
            title={t("auth.logout")}
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="hidden md:flex max-w-7xl mx-auto px-6 py-3 items-center justify-between">
        <div className="flex items-center gap-6">
          <h1
            className="text-xl font-bold text-blue-700 dark:text-blue-400 cursor-pointer hover:text-blue-800 dark:hover:text-blue-300 transition-colors duration-200"
            onClick={() => router.push(isAdmin ? "/admin" : "/trips")}
          >
            Saint Demiana | القديسة ديمانه
          </h1>
          {!isAdmin && (
            <div className="flex gap-1">
              <button
                onClick={() => router.push("/trips")}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200",
                  isActive("/trips")
                    ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 shadow-sm"
                    : "text-slate-500 dark:text-gray-500 hover:bg-slate-50 dark:hover:bg-gray-800/60 hover:text-slate-700 dark:hover:text-gray-300"
                )}
              >
                {t("trips.myBookings")}
              </button>
              <button
                onClick={() => router.push("/settings")}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200",
                  isActive("/settings")
                    ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 shadow-sm"
                    : "text-slate-500 dark:text-gray-500 hover:bg-slate-50 dark:hover:bg-gray-800/60 hover:text-slate-700 dark:hover:text-gray-300"
                )}
              >
                {t("settings.title")}
              </button>
            </div>
          )}
          {isAdmin && (
            <nav className="flex gap-1">
              {navItems.map((item) => (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className={cn(
                    "px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200",
                    isActive(item.href)
                      ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 shadow-sm"
                      : "text-slate-500 dark:text-gray-500 hover:bg-slate-50 dark:hover:bg-gray-800/60 hover:text-slate-700 dark:hover:text-gray-300"
                  )}
                >
                  {item.label}
                </button>
              ))}
              <button
                onClick={() => router.push("/settings")}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200",
                  isActive("/settings")
                    ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 shadow-sm"
                    : "text-slate-500 dark:text-gray-500 hover:bg-slate-50 dark:hover:bg-gray-800/60 hover:text-slate-700 dark:hover:text-gray-300"
                )}
              >
                {t("settings.title")}
              </button>
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400 dark:text-gray-500">
            {t("auth.welcome")}، {profile.full_name}
          </span>
          <ThemeToggle />
          <LanguageToggle />
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50"
          >
            <LogOut className="w-4 h-4" />
            {t("auth.logout")}
          </Button>
        </div>
      </div>
    </header>
  );
}
