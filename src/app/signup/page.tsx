"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { PHONE_REGEX, PASSWORD_MIN_LENGTH } from "@/lib/constants";
import LanguageToggle from "@/components/LanguageToggle";
import ThemeToggle from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Toggle from "@/components/Toggle";
import { Phone, Lock, User, Bus, Car, Users, Accessibility } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Sector } from "@/lib/types/database";

type SignupRole = "patient" | "servant" | "companion" | "family_assistant" | "trainee";

export default function SignupPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState<"Male" | "Female" | "">("");
  const [role, setRole] = useState<SignupRole | "">("");
  const [hasWheelchair, setHasWheelchair] = useState(false);
  const [sectorId, setSectorId] = useState("");
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [transportType, setTransportType] = useState<"private" | "bus">("bus");
  const [servantsNeeded, setServantsNeeded] = useState<0 | 1 | 2>(0);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSectors = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase.rpc("get_sectors");
      if (data) setSectors(data as Sector[]);
    } catch {
      // sectors will be empty, user can still sign up without one
    }
  }, []);

  useEffect(() => {
    loadSectors();
  }, [loadSectors]);

  function handlePhoneChange(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 11);
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
    if (!sectorId) {
      setError(t("auth.sectorRequired"));
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
          sector_id: sectorId,
          transport_type: transportType,
          servants_needed: servantsNeeded,
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

  const roleOptions: { value: SignupRole; labelKey: string }[] = [
    { value: "patient", labelKey: "admin.patient" },
    { value: "servant", labelKey: "admin.servant" },
    { value: "companion", labelKey: "admin.companion" },
    { value: "family_assistant", labelKey: "admin.familyAssistant" },
    { value: "trainee", labelKey: "admin.trainee" },
  ];

  const selectionButtonClass = (isActive: boolean) =>
    cn(
      "flex-1 py-3 rounded-xl text-base font-semibold border-2 transition-all duration-200 min-h-[48px]",
      isActive
        ? "border-blue-500/70 bg-blue-50/80 text-blue-700 dark:border-blue-500/60 dark:bg-blue-950/40 dark:text-blue-300 shadow-sm shadow-blue-500/10"
        : "border-white/30 bg-white/50 text-slate-600 hover:bg-white/70 dark:border-white/10 dark:bg-gray-800/50 dark:text-gray-300 dark:hover:bg-gray-800/70 backdrop-blur-sm"
    );

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
              <User className="w-9 h-9 text-blue-600 dark:text-blue-400" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
              {t("auth.signup")}
            </h1>
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
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
              <Label className="text-slate-500 dark:text-gray-400 mb-2">{t("auth.fullName")}</Label>
              <div className="relative">
                <User className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-gray-500" />
                <Input
                  type="text"
                  className="text-center text-lg pr-10 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <Label className="text-slate-500 dark:text-gray-400 mb-2">{t("auth.gender")}</Label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setGender("Male")}
                  className={selectionButtonClass(gender === "Male")}
                  disabled={loading}
                >
                  {t("auth.male")}
                </button>
                <button
                  type="button"
                  onClick={() => setGender("Female")}
                  className={selectionButtonClass(gender === "Female")}
                  disabled={loading}
                >
                  {t("auth.female")}
                </button>
              </div>
            </div>

            <div>
              <Label className="text-slate-500 dark:text-gray-400 mb-2">{t("auth.userType")}</Label>
              <div className="flex flex-wrap gap-2">
                {roleOptions.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => {
                      setRole(r.value);
                      if (r.value !== "patient") setHasWheelchair(false);
                    }}
                    className={cn(
                      selectionButtonClass(role === r.value),
                      "text-sm",
                      roleOptions.length === 5 && roleOptions.indexOf(r) < 3
                        ? "min-w-[calc(33%-6px)]"
                        : "min-w-[calc(50%-4px)]"
                    )}
                    disabled={loading}
                  >
                    {t(r.labelKey)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-slate-500 dark:text-gray-400 mb-2">{t("sectors.select")}</Label>
              <select
                className={cn(
                  "flex w-full px-4 py-3 text-lg border rounded-xl min-h-[48px]",
                  "bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm",
                  "border-white/40 dark:border-white/10",
                  "text-center text-base",
                  "transition-all duration-200",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:border-blue-500",
                  "dark:text-gray-100 dark:focus-visible:ring-blue-400/40 dark:focus-visible:border-blue-400",
                  "disabled:cursor-not-allowed disabled:opacity-50"
                )}
                value={sectorId}
                onChange={(e) => setSectorId(e.target.value)}
                disabled={loading || sectors.length === 0}
              >
                <option value="">{sectors.length === 0 ? "..." : t("sectors.select")}</option>
                {sectors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} - {s.name}
                  </option>
                ))}
              </select>
            </div>

            {role === "patient" && (
              <div className="flex items-center justify-center gap-3 py-2">
                <Toggle
                  checked={hasWheelchair}
                  onChange={setHasWheelchair}
                  disabled={loading}
                />
                <span className="text-base text-slate-600 dark:text-gray-300 flex items-center gap-1.5">
                  <Accessibility className="w-4 h-4" />
                  {t("auth.wheelchair")}
                </span>
              </div>
            )}

            <div>
              <Label className="text-slate-500 dark:text-gray-400 mb-2">{t("auth.transportType")}</Label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setTransportType("private")}
                  className={cn(selectionButtonClass(transportType === "private"), "flex items-center justify-center gap-2")}
                  disabled={loading}
                >
                  <Car className="w-5 h-5" />
                  {t("auth.transportPrivate")}
                </button>
                <button
                  type="button"
                  onClick={() => setTransportType("bus")}
                  className={cn(selectionButtonClass(transportType === "bus"), "flex items-center justify-center gap-2")}
                  disabled={loading}
                >
                  <Bus className="w-5 h-5" />
                  {t("auth.transportBus")}
                </button>
              </div>
            </div>

            <div>
              <Label className="text-slate-500 dark:text-gray-400 mb-2">{t("auth.servantsNeeded")}</Label>
              <div className="flex gap-3">
                {([0, 1, 2] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setServantsNeeded(n)}
                    className={cn(
                      selectionButtonClass(servantsNeeded === n),
                      "flex items-center justify-center gap-1.5"
                    )}
                    disabled={loading}
                  >
                    <Users className="w-4 h-4" />
                    {n}
                  </button>
                ))}
              </div>
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
              {loading ? t("auth.signingUp") : t("auth.signupButton")}
            </Button>
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
