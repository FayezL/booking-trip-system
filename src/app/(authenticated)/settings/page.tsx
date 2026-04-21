"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useToast } from "@/components/Toast";
import { PASSWORD_MIN_LENGTH, PHONE_REGEX } from "@/lib/constants";
import type { Sector, Profile, FamilyMember } from "@/lib/types/database";

type FamilyForm = {
  full_name: string;
  gender: "Male" | "Female";
  has_wheelchair: boolean;
};

const emptyFamilyForm: FamilyForm = {
  full_name: "",
  gender: "Male",
  has_wheelchair: false,
};

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

  const [newName, setNewName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [transportType, setTransportType] = useState<"private" | "bus">("bus");
  const [servantsNeeded, setServantsNeeded] = useState<0 | 1 | 2>(0);
  const [savingTransport, setSavingTransport] = useState(false);
  const [savingSector, setSavingSector] = useState(false);
  const [savingCar, setSavingCar] = useState(false);

  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [showFamilyForm, setShowFamilyForm] = useState(false);
  const [editingFamilyId, setEditingFamilyId] = useState<string | null>(null);
  const [familyForm, setFamilyForm] = useState<FamilyForm>(emptyFamilyForm);
  const [savingFamily, setSavingFamily] = useState(false);

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
        setNewName(p.full_name);
        setNewPhone(p.phone);
        setTransportType(p.transport_type || "bus");
        setServantsNeeded(p.servants_needed ?? 0);
      }

      const { data: fmData } = await supabase.rpc("get_family_members");
      setFamilyMembers((fmData || []) as FamilyMember[]);
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

  async function handleSaveName() {
    if (!newName.trim()) return;
    setSavingName(true);
    const { error } = await supabase.rpc("update_own_name", { p_name: newName.trim() });
    setSavingName(false);
    if (error) {
      showToast(t("common.error"), "error");
    } else {
      showToast(t("settings.nameUpdated"), "success");
    }
  }

  async function handleSavePhone() {
    const digits = newPhone.replace(/\D/g, "");
    if (!PHONE_REGEX.test(digits)) {
      showToast(t("auth.phoneRequired"), "error");
      return;
    }
    setSavingPhone(true);
    const { error } = await supabase.rpc("update_own_phone", { p_phone: digits });
    setSavingPhone(false);
    if (error) {
      if (error.message.includes("already")) {
        showToast(t("auth.phoneExists"), "error");
      } else {
        showToast(t("common.error"), "error");
      }
    } else {
      showToast(t("settings.phoneUpdated"), "success");
    }
  }

  async function handleSavePassword() {
    if (!currentPassword || !newPassword || newPassword.length < PASSWORD_MIN_LENGTH) {
      showToast(t("auth.passwordRequired"), "error");
      return;
    }

    setSavingPassword(true);

    const phone = profile?.phone || "";
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: `${phone}@church.local`,
      password: currentPassword,
    });

    if (verifyError) {
      setSavingPassword(false);
      showToast(t("settings.wrongPassword"), "error");
      return;
    }

    const { error } = await supabase.rpc("update_own_password", { p_new_password: newPassword });
    setSavingPassword(false);

    if (error) {
      showToast(t("common.error"), "error");
    } else {
      setCurrentPassword("");
      setNewPassword("");
      showToast(t("settings.passwordUpdated"), "success");
    }
  }

  async function handleSaveTransport() {
    setSavingTransport(true);
    const { error } = await supabase.rpc("update_own_transport", {
      p_transport_type: transportType,
      p_servants_needed: servantsNeeded,
    });
    setSavingTransport(false);
    if (error) {
      showToast(t("common.error"), "error");
    } else {
      showToast(t("settings.transportUpdated"), "success");
    }
  }

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

  function startAddFamily() {
    setEditingFamilyId(null);
    setFamilyForm(emptyFamilyForm);
    setShowFamilyForm(true);
  }

  function startEditFamily(member: FamilyMember) {
    setEditingFamilyId(member.id);
    setFamilyForm({
      full_name: member.full_name,
      gender: member.gender,
      has_wheelchair: member.has_wheelchair,
    });
    setShowFamilyForm(true);
  }

  async function handleSaveFamily() {
    if (!familyForm.full_name.trim()) {
      showToast(t("auth.nameRequired"), "error");
      return;
    }

    setSavingFamily(true);

    if (editingFamilyId) {
      const { error } = await supabase.rpc("update_family_member", {
        p_member_id: editingFamilyId,
        p_full_name: familyForm.full_name.trim(),
        p_gender: familyForm.gender,
        p_has_wheelchair: familyForm.has_wheelchair,
      });
      setSavingFamily(false);
      if (error) {
        showToast(t("common.error"), "error");
      } else {
        showToast(t("family.memberUpdated"), "success");
        setShowFamilyForm(false);
        loadData();
      }
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.rpc("add_family_member", {
        p_head_user_id: user.id,
        p_full_name: familyForm.full_name.trim(),
        p_gender: familyForm.gender,
        p_has_wheelchair: familyForm.has_wheelchair,
      });
      setSavingFamily(false);
      if (error) {
        showToast(t("common.error"), "error");
      } else {
        showToast(t("family.memberAdded"), "success");
        setShowFamilyForm(false);
        loadData();
      }
    }
  }

  async function handleRemoveFamily(memberId: string) {
    if (!confirm(t("family.confirmRemove"))) return;
    const { error } = await supabase.rpc("remove_family_member", { p_member_id: memberId });
    if (error) {
      showToast(t("common.error"), "error");
    } else {
      showToast(t("family.memberRemoved"), "success");
      loadData();
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
    <div className="animate-fade-in space-y-4">
      <h1 className="section-title mb-6">{t("settings.title")}</h1>

      {/* Account Section */}
      <div className="card">
        <h2 className="text-lg font-bold text-slate-800 dark:text-gray-100 mb-4">{t("settings.accountGroup")}</h2>
        <div className="space-y-4">
          <div>
            <label className="label-text">{t("settings.changeName")}</label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                className="input-field flex-1"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                disabled={savingName}
              />
              <button
                onClick={handleSaveName}
                disabled={savingName || !newName.trim() || newName.trim() === profile?.full_name}
                className="btn-primary w-full sm:w-auto shrink-0"
              >
                {savingName ? t("common.loading") : t("common.save")}
              </button>
            </div>
          </div>

          <div>
            <label className="label-text">{t("settings.changePhone")}</label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                className="input-field flex-1 font-mono tracking-widest"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, "").slice(0, 15))}
                dir="ltr"
                disabled={savingPhone}
              />
              <button
                onClick={handleSavePhone}
                disabled={savingPhone || !PHONE_REGEX.test(newPhone.replace(/\D/g, "")) || newPhone === profile?.phone}
                className="btn-primary w-full sm:w-auto shrink-0"
              >
                {savingPhone ? t("common.loading") : t("common.save")}
              </button>
            </div>
          </div>

          <div>
            <label className="label-text">{t("settings.changePassword")}</label>
            <div className="space-y-3">
              <input
                type="password"
                className="input-field"
                placeholder={t("settings.currentPassword")}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                dir="ltr"
                disabled={savingPassword}
              />
              <input
                type="password"
                className="input-field"
                placeholder={t("settings.newPasswordLabel")}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                dir="ltr"
                disabled={savingPassword}
              />
              <button
                onClick={handleSavePassword}
                disabled={savingPassword || !currentPassword || newPassword.length < PASSWORD_MIN_LENGTH}
                className="btn-primary w-full sm:w-auto"
              >
                {savingPassword ? t("common.loading") : t("common.save")}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Trip Details Section */}
      <div className="card">
        <h2 className="text-lg font-bold text-slate-800 dark:text-gray-100 mb-4">{t("settings.tripDetailsGroup")}</h2>
        <div className="space-y-4">
          <div>
            <label className="label-text">{t("settings.transportType")}</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setTransportType("private")}
                className={`flex-1 py-3 rounded-xl text-base font-semibold border-2 transition-all duration-150 min-h-[48px]
                  ${transportType === "private"
                    ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-400 shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 active:bg-slate-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  }`}
              >
                {t("settings.transportPrivate")}
              </button>
              <button
                type="button"
                onClick={() => setTransportType("bus")}
                className={`flex-1 py-3 rounded-xl text-base font-semibold border-2 transition-all duration-150 min-h-[48px]
                  ${transportType === "bus"
                    ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-400 shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 active:bg-slate-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  }`}
              >
                {t("settings.transportBus")}
              </button>
            </div>
          </div>

          <div>
            <label className="label-text">{t("settings.servantsNeeded")}</label>
            <div className="flex gap-3">
              {([0, 1, 2] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setServantsNeeded(n)}
                  className={`flex-1 py-3 rounded-xl text-base font-semibold border-2 transition-all duration-150 min-h-[48px]
                    ${servantsNeeded === n
                      ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-400 shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 active:bg-slate-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                    }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label-text">{t("settings.sector")}</label>
            {currentSectorName && (
              <p className="text-sm text-slate-400 dark:text-gray-500 mb-2">
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

          <button
            onClick={handleSaveTransport}
            disabled={savingTransport}
            className="btn-primary w-full sm:w-auto"
          >
            {savingTransport ? t("common.loading") : t("common.save")}
          </button>
        </div>
      </div>

      {/* Family Members Section */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800 dark:text-gray-100">{t("family.title")}</h2>
          <button onClick={startAddFamily} className="btn-primary text-sm">
            + {t("family.add")}
          </button>
        </div>

        {showFamilyForm && (
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-gray-800/50 mb-4 animate-slide-up">
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
              <div>
                <label className="label-text">{t("family.name")}</label>
                <input
                  className="input-field"
                  value={familyForm.full_name}
                  onChange={(e) => setFamilyForm({ ...familyForm, full_name: e.target.value })}
                />
              </div>
              <div>
                <label className="label-text">{t("family.gender")}</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setFamilyForm({ ...familyForm, gender: "Male" })}
                    className={`flex-1 py-3 rounded-xl text-base font-semibold border-2 transition-all duration-150 min-h-[48px]
                      ${familyForm.gender === "Male"
                        ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-400"
                        : "border-slate-200 bg-white text-slate-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                      }`}
                  >
                    {t("family.male")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFamilyForm({ ...familyForm, gender: "Female" })}
                    className={`flex-1 py-3 rounded-xl text-base font-semibold border-2 transition-all duration-150 min-h-[48px]
                      ${familyForm.gender === "Female"
                        ? "border-pink-500 bg-pink-50 text-pink-700 dark:border-pink-500 dark:bg-pink-950/50 dark:text-pink-400"
                        : "border-slate-200 bg-white text-slate-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                      }`}
                  >
                    {t("family.female")}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3 sm:col-span-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={familyForm.has_wheelchair}
                  onClick={() => setFamilyForm({ ...familyForm, has_wheelchair: !familyForm.has_wheelchair })}
                  className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    familyForm.has_wheelchair ? "bg-blue-600" : "bg-slate-200 dark:bg-gray-700"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      familyForm.has_wheelchair ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
                <span className="text-sm text-slate-600 dark:text-gray-300">♿ {t("family.wheelchair")}</span>
              </div>
            </div>
            <div className="flex gap-3 mt-3">
              <button onClick={handleSaveFamily} disabled={savingFamily || !familyForm.full_name.trim()} className="btn-primary text-sm">
                {savingFamily ? t("common.loading") : t("common.save")}
              </button>
              <button onClick={() => setShowFamilyForm(false)} className="btn-secondary text-sm">
                {t("admin.cancel")}
              </button>
            </div>
          </div>
        )}

        {familyMembers.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-gray-500 text-center py-4">{t("family.noMembers")}</p>
        ) : (
          <div className="space-y-2">
            {familyMembers.map((member, idx) => (
              <div key={member.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-gray-800/50">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-500 dark:text-gray-400">{idx + 1}.</span>
                  <span className="text-sm font-medium text-slate-800 dark:text-gray-100">{member.full_name}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                    member.gender === "Male" ? "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400" : "bg-pink-50 dark:bg-pink-950/30 text-pink-600 dark:text-pink-400"
                  }`}>
                    {member.gender === "Male" ? "♂" : "♀"}
                  </span>
                  {member.has_wheelchair && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400">♿</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => startEditFamily(member)}
                    className="px-2 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300 active:scale-95 transition-all duration-150"
                  >
                    {t("common.edit")}
                  </button>
                  <button
                    onClick={() => handleRemoveFamily(member.id)}
                    className="px-2 py-1 rounded-lg text-xs font-medium bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 active:scale-95 transition-all duration-150"
                  >
                    {t("common.delete")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Car Section — servants only */}
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
