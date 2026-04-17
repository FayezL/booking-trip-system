"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { PHONE_REGEX, PASSWORD_MIN_LENGTH } from "@/lib/constants";
import LanguageToggle from "@/components/LanguageToggle";
import ThemeToggle from "@/components/ThemeToggle";

type SignupRole = "patient" | "servant" | "companion" | "family_assistant";

export default function SignupPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState<"Male" | "Female" | "">("");
  const [role, setRole] = useState<SignupRole | "">("");
  const [hasWheelchair, setHasWheelchair] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handlePhoneChange(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 15);
    setPhone(digits);
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!PHONE_REGEX.test(phone)) {
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
    if (!role) {
      setError(t("auth.userType"));
      return;
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(t("auth.passwordRequired"));
      return;
    }

    setLoading(true);
    const email = `${phone}@church.local`;
    const supabase = createClient();

    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          gender,
          role,
          has_wheelchair: hasWheelchair,
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-slate-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4">
      <div className="w-full max-w-md animate-slide-up">
        <div className="flex justify-end gap-2 mb-4">
          <ThemeToggle />
          <LanguageToggle />
        </div>
        <div className="card">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-gray-100">
              {t("auth.signup")}
            </h1>
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="label-text">{t("auth.phone")}</label>
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="tel"
                className="input-field text-center text-xl tracking-widest font-mono"
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="01XXXXXXXXX"
                dir="ltr"
                disabled={loading}
              />
              <p className="text-xs text-slate-400 dark:text-gray-500 mt-1 text-center">
                {t("auth.phoneHint")}
              </p>
            </div>

            <div>
              <label className="label-text">{t("auth.fullName")}</label>
              <input
                type="text"
                className="input-field text-center text-lg"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <label className="label-text">{t("auth.gender")}</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setGender("Male")}
                  className={`flex-1 py-3 rounded-xl text-base font-semibold border-2 transition-all duration-150 min-h-[48px]
                    ${gender === "Male"
                      ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-400 shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 active:bg-slate-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                    }`}
                  disabled={loading}
                >
                  {t("auth.male")}
                </button>
                <button
                  type="button"
                  onClick={() => setGender("Female")}
                  className={`flex-1 py-3 rounded-xl text-base font-semibold border-2 transition-all duration-150 min-h-[48px]
                    ${gender === "Female"
                      ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-400 shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 active:bg-slate-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                    }`}
                  disabled={loading}
                >
                  {t("auth.female")}
                </button>
              </div>
            </div>

            <div>
              <label className="label-text">{t("auth.userType")}</label>
              <div className="grid grid-cols-2 gap-2">
                {(["patient", "servant", "companion", "family_assistant"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setRole(r);
                      if (r !== "patient") setHasWheelchair(false);
                    }}
                    className={`py-3 rounded-xl text-sm font-semibold border-2 transition-all duration-150 min-h-[48px]
                      ${role === r
                        ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-400 shadow-sm"
                        : "border-slate-200 bg-white text-slate-600 active:bg-slate-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                      }`}
                    disabled={loading}
                  >
                    {t(`admin.${r === "patient" ? "patient" : r === "servant" ? "servant" : r === "companion" ? "companion" : "familyAssistant"}`)}
                  </button>
                ))}
              </div>
            </div>

            {role === "patient" && (
              <div className="flex items-center justify-center gap-3 py-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={hasWheelchair}
                  onClick={() => setHasWheelchair(!hasWheelchair)}
                  className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    hasWheelchair ? "bg-blue-600" : "bg-slate-200 dark:bg-gray-700"
                  }`}
                  disabled={loading}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      hasWheelchair ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
                <span className="text-base text-slate-600 dark:text-gray-300">
                  ♿ {t("auth.wheelchair")}
                </span>
              </div>
            )}

            <div>
              <label className="label-text">{t("auth.password")}</label>
              <input
                type="password"
                className="input-field text-center text-xl tracking-wider"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                dir="ltr"
                disabled={loading}
              />
              <p className="text-xs text-slate-400 dark:text-gray-500 mt-1 text-center">
                {t("auth.passwordHint")}
              </p>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 p-3 rounded-xl text-center text-base font-medium animate-fade-in">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary w-full text-lg"
              disabled={loading}
            >
              {loading ? t("auth.signingUp") : t("auth.signupButton")}
            </button>
          </form>

          <p className="text-center mt-6 text-base text-slate-500 dark:text-gray-400">
            {t("auth.hasAccount")}{" "}
            <a href="/login" className="text-blue-600 dark:text-blue-400 font-semibold hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
              {t("auth.loginHere")}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
