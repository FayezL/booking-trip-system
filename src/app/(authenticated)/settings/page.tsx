"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useToast } from "@/components/Toast";
import type { Sector, Profile } from "@/lib/types/database";

export default function SettingsPage() {
  const { t } = useTranslation();
  const supabase = createClient();
  const { showToast } = useToast();

  const [sectors, setSectors] = useState<Sector[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentSectorId, setCurrentSectorId] = useState<string | null>(null);
  const [selectedSector, setSelectedSector] = useState<string>("");
  const [hasCar, setHasCar] = useState(false);
  const [carSeats, setCarSeats] = useState(4);
  const [loading, setLoading] = useState(true);
  const [savingSector, setSavingSector] = useState(false);
  const [savingCar, setSavingCar] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [sectorsRes, { data: { user } }] = await Promise.all([
        supabase.rpc("get_sectors"),
        supabase.auth.getUser(),
      ]);
      if (!user) return;

      setSectors((sectorsRes.data || []) as Sector[]);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileData) {
        const p = profileData as Profile;
        setProfile(p);
        setCurrentSectorId(p.sector_id);
        setSelectedSector(p.sector_id || "");
        setHasCar(p.has_car);
        setCarSeats(p.car_seats || 4);
      }
    } catch {
      showToast(t("common.error"), "error");
    } finally {
      setLoading(false);
    }
  }, [supabase, showToast, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const currentSectorName = useMemo(() => {
    if (!currentSectorId) return "";
    return sectors.find((s) => s.id === currentSectorId)?.name || "";
  }, [currentSectorId, sectors]);

  const isServant = profile?.role === "servant";

  async function handleSaveSector() {
    if (selectedSector === (currentSectorId || "")) return;

    setSavingSector(true);
    const { error } = await supabase.rpc("update_own_sector", {
      p_sector_id: selectedSector || null,
    });
    setSavingSector(false);

    if (error) {
      showToast(t("common.error"), "error");
    } else {
      setCurrentSectorId(selectedSector || null);
      showToast(t("settings.saved"), "success");
    }
  }

  async function handleSaveCar() {
    setSavingCar(true);
    const { error } = await supabase.rpc("update_own_car_settings", {
      p_has_car: hasCar,
      p_car_seats: hasCar ? carSeats : null,
    });
    setSavingCar(false);

    if (error) {
      showToast(t("common.error"), "error");
    } else {
      showToast(t("settings.saved"), "success");
    }
  }

  if (loading) {
    return (
      <div className="animate-fade-in">
        <h1 className="section-title mb-6">{t("settings.title")}</h1>
        <div className="card">
          <p className="text-slate-400 dark:text-gray-500 text-center py-8">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h1 className="section-title mb-6">{t("settings.title")}</h1>

      <div className="card mb-4">
        <h2 className="text-lg font-bold text-slate-800 dark:text-gray-100 mb-4">{t("settings.sector")}</h2>

        {currentSectorName && (
          <p className="text-sm text-slate-400 dark:text-gray-500 mb-3">
            {t("sectors.yourSector")}: <span className="font-medium text-teal-600 dark:text-teal-400">{currentSectorName}</span>
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <select
            className="input-field flex-1"
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
          >
            <option value="">{t("sectors.select")}</option>
            {sectors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} - {s.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleSaveSector}
            disabled={savingSector || selectedSector === (currentSectorId || "")}
            className="btn-primary w-full sm:w-auto shrink-0"
          >
            {savingSector ? t("common.loading") : t("common.save")}
          </button>
        </div>
      </div>

      {isServant && (
        <div className="card">
          <h2 className="text-lg font-bold text-slate-800 dark:text-gray-100 mb-4">{t("cars.register")}</h2>
          <p className="text-xs text-slate-400 dark:text-gray-500 mb-4">
            {t("settings.carSeatsHint")}
          </p>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={hasCar}
                onClick={() => setHasCar(!hasCar)}
                className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  hasCar ? "bg-blue-600" : "bg-slate-200 dark:bg-gray-700"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    hasCar ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
              <span className="text-base text-slate-600 dark:text-gray-300">{t("settings.hasCar")}</span>
            </div>

            {hasCar && (
              <div>
                <label className="label-text">{t("settings.carSeats")}</label>
                <input
                  type="number"
                  className="input-field w-24 text-center"
                  value={carSeats}
                  onChange={(e) => setCarSeats(Math.max(1, parseInt(e.target.value) || 1))}
                  min="1"
                  max="20"
                  dir="ltr"
                />
              </div>
            )}

            <button
              onClick={handleSaveCar}
              disabled={savingCar}
              className="btn-primary w-full sm:w-auto"
            >
              {savingCar ? t("common.loading") : t("common.save")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
