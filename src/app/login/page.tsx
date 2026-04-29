"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, setSessionPersistence } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { PHONE_REGEX, PASSWORD_MIN_LENGTH } from "@/lib/constants";
import LanguageToggle from "@/components/LanguageToggle";
import ThemeToggle from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Toggle from "@/components/Toggle";
import { Phone, Lock, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handlePhoneChange(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    setPhone(digits);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!PHONE_REGEX.test(phone)) {
      setError(t("auth.phoneRequired"));
      return;
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(t("auth.passwordRequired"));
      return;
    }

    setLoading(true);
    const email = `${phone}@church.local`;
    const supabase = createClient();

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (authError) {
      setError(t("auth.invalidCredentials"));
      return;
    }

    if (!rememberMe) {
      setSessionPersistence(false);
    }

    router.push("/trips");
  }

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
              <Users className="w-9 h-9 text-blue-600 dark:text-blue-400" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
              {t("auth.login")}
            </h1>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <Label className="text-slate-500 dark:text-gray-400 mb-2">{t("auth.phone")}</Label>
              <div className="relative">
                <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-gray-500" />
                <Input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="tel"
                  className="text-center text-xl tracking-widest font-mono pr-10 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm"
                  maxLength={11}
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  dir="ltr"
                  disabled={loading}
                />
              </div>
              <p className="text-xs text-slate-400 dark:text-gray-500 mt-1.5 text-center">
                {t("auth.phoneHint")}
              </p>
            </div>

            <div>
              <Label className="text-slate-500 dark:text-gray-400 mb-2">{t("auth.password")}</Label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-gray-500" />
                <Input
                  type="password"
                  className="text-center text-xl tracking-wider pr-10 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  dir="ltr"
                  disabled={loading}
                />
              </div>
              <p className="text-xs text-slate-400 dark:text-gray-500 mt-1.5 text-center">
                {t("auth.passwordHint")}
              </p>
            </div>

            <div className="flex items-center justify-center gap-3">
              <Toggle
                checked={rememberMe}
                onChange={setRememberMe}
                disabled={loading}
              />
              <Label htmlFor="rememberMe" className="text-base text-slate-500 dark:text-gray-400 cursor-pointer">
                {t("auth.rememberMe")}
              </Label>
            </div>

            {error && (
              <div className="bg-red-50/80 dark:bg-red-950/40 backdrop-blur-sm text-red-600 dark:text-red-400 p-3 rounded-xl text-center text-base font-medium animate-fade-in border border-red-200/50 dark:border-red-800/30">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full text-lg shadow-lg shadow-blue-600/20 dark:shadow-blue-500/10"
              disabled={loading}
            >
              {loading ? t("auth.loggingIn") : t("auth.loginButton")}
            </Button>
          </form>

          <p className="text-center mt-6 text-base text-slate-500 dark:text-gray-400">
            {t("auth.noAccount")}{" "}
            <a href="/signup" className="text-blue-600 dark:text-blue-400 font-semibold hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
              {t("auth.registerHere")}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
