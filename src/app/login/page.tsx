"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, setSessionPersistence } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import LanguageToggle from "@/components/LanguageToggle";

export default function LoginPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!phone.trim() || !/^\d{8,15}$/.test(phone.trim())) {
      setError(t("auth.phoneRequired"));
      return;
    }
    if (!password.trim() || password.length < 6) {
      setError(t("auth.passwordRequired"));
      return;
    }

    setLoading(true);
    const email = `${phone.trim()}@church.local`;
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-end mb-4">
          <LanguageToggle />
        </div>
        <div className="card">
          <h1 className="text-2xl font-bold text-center mb-8">
            {t("auth.login")}
          </h1>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="label-text">{t("auth.phone")}</label>
              <input
                type="tel"
                className="input-field"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                dir="ltr"
                disabled={loading}
              />
            </div>

            <div>
              <label className="label-text">{t("auth.password")}</label>
              <input
                type="password"
                className="input-field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                dir="ltr"
                disabled={loading}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="rememberMe" className="text-sm text-gray-600">
                {t("auth.rememberMe")}
              </label>
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 p-3 rounded-lg text-center text-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary w-full"
              disabled={loading}
            >
              {loading ? t("auth.loggingIn") : t("auth.loginButton")}
            </button>
          </form>

          <p className="text-center mt-6 text-lg text-gray-600">
            {t("auth.noAccount")}{" "}
            <a href="/signup" className="text-emerald-600 font-semibold hover:underline">
              {t("auth.registerHere")}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
