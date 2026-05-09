"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n/useTranslation";
import LanguageToggle from "@/components/LanguageToggle";
import ThemeToggle from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Shield, Users, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SignupPage() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-100 via-indigo-50 to-slate-100 dark:from-gray-950 dark:via-slate-900 dark:to-indigo-950" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.15),transparent_50%)] dark:bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.08),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(59,130,246,0.12),transparent_50%)] dark:bg-[radial-gradient(ellipse_at_bottom_left,rgba(59,130,246,0.06),transparent_50%)]" />

      <div className="w-full max-w-md animate-slide-up relative z-10">
        <div className="flex justify-end gap-2 mb-4">
          <ThemeToggle />
          <LanguageToggle />
        </div>

        <div className={cn(
          "rounded-2xl p-8",
          "bg-white/60 dark:bg-gray-900/60",
          "backdrop-blur-xl",
          "border border-white/40 dark:border-white/10",
          "shadow-xl shadow-blue-500/5 dark:shadow-indigo-500/5",
          "ring-1 ring-white/20 dark:ring-white/5"
        )}>
          <div className="text-center mb-8">
            <div className={cn(
              "w-18 h-18 rounded-2xl flex items-center justify-center mx-auto mb-4",
              "bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950/40 dark:to-indigo-950/40",
              "shadow-inner"
            )}>
              <Shield className="w-9 h-9 text-blue-600 dark:text-blue-400" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
              {t("auth.privateSystem")}
            </h1>
          </div>

          <div className="space-y-6">
            <p className="text-center text-base text-slate-600 dark:text-gray-300 leading-relaxed">
              {t("auth.privateSystemDesc")}
            </p>

            <div className={cn(
              "rounded-xl p-4",
              "bg-blue-50/80 dark:bg-blue-950/30",
              "border border-blue-200/50 dark:border-blue-800/30",
              "flex items-start gap-3"
            )}>
              <Users className="w-5 h-5 text-blue-500 dark:text-blue-400 mt-0.5 shrink-0" />
              <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
                {t("auth.contactAdminDesc")}
              </p>
            </div>

            <Button
              onClick={() => router.push("/login")}
              className="w-full text-lg shadow-lg shadow-blue-600/20 dark:shadow-blue-500/10"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              {t("auth.backToLogin")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
