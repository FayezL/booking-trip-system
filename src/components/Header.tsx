"use client";

import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
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
    <header className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-gray-800 sticky top-0 z-50">
      {/* Mobile Header */}
      <div className="md:hidden px-4 py-2.5 flex items-center justify-between">
        <h1
          className="text-lg font-bold text-blue-700 dark:text-blue-400 cursor-pointer"
          onClick={() => router.push(isAdmin ? "/admin" : "/trips")}
        >
          Verena Church
        </h1>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg text-slate-400 dark:text-gray-500 hover:bg-slate-100 dark:hover:bg-gray-800 hover:text-red-500 dark:hover:text-red-400 active:scale-95 transition-all duration-150"
            title={t("auth.logout")}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>

      {/* Desktop Header */}
      <div className="hidden md:flex max-w-7xl mx-auto px-6 py-3 items-center justify-between">
        <div className="flex items-center gap-6">
          <h1
            className="text-xl font-bold text-blue-700 dark:text-blue-400 cursor-pointer hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
            onClick={() => router.push(isAdmin ? "/admin" : "/trips")}
          >
            Verena Church
          </h1>
          {!isAdmin && (
            <button
              onClick={() => router.push("/trips")}
              className="text-sm text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              {t("trips.myBookings")}
            </button>
          )}
          {isAdmin && (
            <nav className="flex gap-1">
              {navItems.map((item) => (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-150 ${
                    isActive(item.href)
                      ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400"
                      : "text-slate-500 dark:text-gray-500 hover:bg-slate-50 dark:hover:bg-gray-800 hover:text-slate-700 dark:hover:text-gray-300"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400 dark:text-gray-500">
            {t("auth.welcome")}، {profile.full_name}
          </span>
          <ThemeToggle />
          <LanguageToggle />
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 text-sm font-medium text-red-500 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/50 active:scale-95 transition-all duration-150"
          >
            {t("auth.logout")}
          </button>
        </div>
      </div>
    </header>
  );
}
