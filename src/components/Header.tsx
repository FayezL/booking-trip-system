"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import LanguageToggle from "./LanguageToggle";
import type { Profile } from "@/lib/types/database";

interface HeaderProps {
  profile: Profile;
}

export default function Header({ profile }: HeaderProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const supabase = createClient();

  const isAdmin = profile.role === "servant" || profile.role === "super_admin";

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1
            className="text-xl font-bold text-emerald-700 cursor-pointer"
            onClick={() => router.push(isAdmin ? "/admin" : "/trips")}
          >
            Verena Church
          </h1>
          {isAdmin && (
            <nav className="flex gap-2 flex-wrap">
              <button
                onClick={() => router.push("/admin")}
                className="px-3 py-1.5 text-sm font-medium rounded-md hover:bg-gray-100 transition-colors"
              >
                {t("admin.dashboard")}
              </button>
              <button
                onClick={() => router.push("/admin/trips")}
                className="px-3 py-1.5 text-sm font-medium rounded-md hover:bg-gray-100 transition-colors"
              >
                {t("admin.trips")}
              </button>
              <button
                onClick={() => router.push("/admin/reports")}
                className="px-3 py-1.5 text-sm font-medium rounded-md hover:bg-gray-100 transition-colors"
              >
                {t("admin.reports")}
              </button>
              {profile.role === "super_admin" && (
                <>
                  <button
                    onClick={() => router.push("/admin/users")}
                    className="px-3 py-1.5 text-sm font-medium rounded-md hover:bg-gray-100 transition-colors"
                  >
                    {t("admin.users")}
                  </button>
                  <button
                    onClick={() => router.push("/admin/logs")}
                    className="px-3 py-1.5 text-sm font-medium rounded-md hover:bg-gray-100 transition-colors"
                  >
                    {t("admin.activityLogs")}
                  </button>
                </>
              )}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">
            {t("auth.welcome")}، {profile.full_name}
          </span>
          <LanguageToggle />
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 text-sm font-medium text-red-600 rounded-md hover:bg-red-50 transition-colors"
          >
            {t("auth.logout")}
          </button>
        </div>
      </div>
    </header>
  );
}
