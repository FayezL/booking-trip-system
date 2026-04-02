"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import LanguageToggle from "@/components/LanguageToggle";

export default function SignupPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const supabase = createClient();

  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState<"Male" | "Female" | "">("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!phone.trim() || !/^\d{8,15}$/.test(phone.trim())) {
      setError(t("auth.phoneRequired"));
      return;
    }
    if (!fullName.trim()) {
      setError(t("auth.nameRequired"));
      return;
    }
    if (!gender) {
      setError(t("auth.genderRequired"));
      return;
    }
    if (!password.trim() || password.length < 6) {
      setError(t("auth.passwordRequired"));
      return;
    }

    setLoading(true);
    const email = `${phone.trim()}@church.local`;

    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          gender,
        },
      },
    });

    setLoading(false);

    if (authError) {
      if (authError.message.includes("already registered")) {
        setError(t("auth.phoneExists"));
      } else {
        setError(t("common.error"));
      }
      return;
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
            {t("auth.signup")}
          </h1>

          <form onSubmit={handleSignup} className="space-y-6">
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
              <label className="label-text">{t("auth.fullName")}</label>
              <input
                type="text"
                className="input-field"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <label className="label-text">{t("auth.gender")}</label>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setGender("Male")}
                  className={`flex-1 py-3 rounded-lg text-lg font-semibold border-2 transition-colors min-h-[48px]
                    ${gender === "Male"
                      ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                      : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                    }`}
                  disabled={loading}
                >
                  {t("auth.male")}
                </button>
                <button
                  type="button"
                  onClick={() => setGender("Female")}
                  className={`flex-1 py-3 rounded-lg text-lg font-semibold border-2 transition-colors min-h-[48px]
                    ${gender === "Female"
                      ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                      : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                    }`}
                  disabled={loading}
                >
                  {t("auth.female")}
                </button>
              </div>
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
              {loading ? t("auth.signingUp") : t("auth.signupButton")}
            </button>
          </form>

          <p className="text-center mt-6 text-lg text-gray-600">
            {t("auth.hasAccount")}{" "}
            <a href="/login" className="text-emerald-600 font-semibold hover:underline">
              {t("auth.loginHere")}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
