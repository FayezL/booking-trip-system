"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import LanguageToggle from "@/components/LanguageToggle";
import ThemeToggle from "@/components/ThemeToggle";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { UserPlus, Phone, User, KeyRound } from "lucide-react";

type SignupRole = "patient" | "companion" | "family_assistant";

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
    if (!role) {
      setError(t("auth.userType"));
      return;
    }
    if (!password.trim() || password.length < 6) {
      setError(t("auth.passwordRequired"));
      return;
    }

    setLoading(true);
    const email = `${phone.trim()}@church.local`;
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

  const roleLabels: Record<SignupRole, string> = {
    patient: "admin.patient",
    companion: "admin.companion",
    family_assistant: "admin.familyAssistant",
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-slate-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4">
      <div className="w-full max-w-md animate-slide-up">
        <div className="flex justify-end mb-4 gap-2">
          <ThemeToggle />
          <LanguageToggle />
        </div>
        <Card>
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <UserPlus className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">{t("auth.signup")}</h1>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignup} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="phone">{t("auth.phone")}</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    dir="ltr"
                    disabled={loading}
                    className="ps-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fullName">{t("auth.fullName")}</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={loading}
                    className="ps-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("auth.gender")}</Label>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant={gender === "Male" ? "default" : "outline"}
                    onClick={() => setGender("Male")}
                    disabled={loading}
                    className="flex-1"
                  >
                    {t("auth.male")}
                  </Button>
                  <Button
                    type="button"
                    variant={gender === "Female" ? "default" : "outline"}
                    onClick={() => setGender("Female")}
                    disabled={loading}
                    className="flex-1"
                  >
                    {t("auth.female")}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("auth.userType")}</Label>
                <div className="flex gap-2 flex-wrap">
                  {(["patient", "companion", "family_assistant"] as const).map((r) => (
                    <Button
                      key={r}
                      type="button"
                      variant={role === r ? "default" : "outline"}
                      onClick={() => {
                        setRole(r);
                        if (r !== "patient") setHasWheelchair(false);
                      }}
                      disabled={loading}
                      className="flex-1 min-w-[90px]"
                    >
                      {t(roleLabels[r])}
                    </Button>
                  ))}
                </div>
              </div>

              {role === "patient" && (
                <div className="flex items-center gap-3">
                  <Switch
                    id="wheelchair"
                    checked={hasWheelchair}
                    onCheckedChange={setHasWheelchair}
                    disabled={loading}
                  />
                  <Label htmlFor="wheelchair" className="cursor-pointer">
                    {t("auth.wheelchair")}
                  </Label>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">{t("auth.password")}</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    dir="ltr"
                    disabled={loading}
                    className="ps-10"
                  />
                </div>
              </div>

              {error && (
                <div className="bg-destructive/10 text-destructive p-3 rounded-xl text-center text-sm font-medium" role="alert">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t("auth.signingUp") : t("auth.signupButton")}
              </Button>
            </form>

            <p className="text-center mt-6 text-sm text-muted-foreground">
              {t("auth.hasAccount")}{" "}
              <Link href="/login" className="text-primary hover:underline">
                {t("auth.loginHere")}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
