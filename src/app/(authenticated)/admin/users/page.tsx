"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useToast } from "@/components/Toast";
import LoadingSpinner from "@/components/LoadingSpinner";
import { logAction } from "@/lib/admin-logs";
import type { Profile, Sector } from "@/lib/types/database";

type UserRole = "admin" | "servant" | "patient" | "companion" | "family_assistant";

type PersonForm = {
  phone: string;
  full_name: string;
  gender: "Male" | "Female";
  password: string;
  role: UserRole;
  has_wheelchair: boolean;
  sector_id: string;
};

const emptyPersonForm: PersonForm = {
  phone: "",
  full_name: "",
  gender: "Male",
  password: "",
  role: "patient",
  has_wheelchair: false,
  sector_id: "",
};

const ALL_ROLES: ("super_admin" | UserRole)[] = ["super_admin", "admin", "servant", "patient", "companion", "family_assistant"];
const CREATABLE_ROLES: UserRole[] = ["admin", "patient", "companion", "family_assistant"];

function getRoleLabel(role: string, t: (key: string) => string): string {
  switch (role) {
    case "super_admin": return t("admin.superAdmin");
    case "admin": return t("admin.adminRole");
    case "servant": return t("admin.servant");
    case "patient": return t("admin.patient");
    case "companion": return t("admin.companion");
    case "family_assistant": return t("admin.familyAssistant");
    default: return role;
  }
}

function getRoleBadgeClasses(role: string): string {
  switch (role) {
    case "super_admin": return "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400";
    case "admin": return "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400";
    case "servant": return "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400";
    case "patient": return "bg-slate-50 dark:bg-gray-800 text-slate-600 dark:text-gray-400";
    case "companion": return "bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400";
    case "family_assistant": return "bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400";
    default: return "bg-slate-50 dark:bg-gray-800 text-slate-600 dark:text-gray-400";
  }
}

export default function UsersPage() {
  const { t } = useTranslation();
  const supabase = createClient();
  const { showToast } = useToast();

  const [users, setUsers] = useState<Profile[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [sectorFilter, setSectorFilter] = useState("");
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<PersonForm>(emptyPersonForm);
  const [creating, setCreating] = useState(false);
  const [changingRoleUserId, setChangingRoleUserId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [editingCarUserId, setEditingCarUserId] = useState<string | null>(null);
  const [carFormHasCar, setCarFormHasCar] = useState(false);
  const [carFormSeats, setCarFormSeats] = useState(4);
  const [savingCar, setSavingCar] = useState(false);

  const PAGE_SIZE = 20;

  const sectorMap = useMemo(() => {
    const map = new Map<string, Sector>();
    for (const s of sectors) map.set(s.id, s);
    return map;
  }, [sectors]);

  const loadData = useCallback(async () => {
    try {
      const [usersRes, sectorsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
        supabase.rpc("get_sectors"),
      ]);
      if (usersRes.error) throw usersRes.error;
      setUsers((usersRes.data || []) as Profile[]);
      setSectors((sectorsRes.data || []) as Sector[]);
    } catch {
      showToast(t("common.error"), "error");
    } finally {
      setLoading(false);
    }
  }, [supabase, showToast, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleResetPassword() {
    if (!resetUserId || !newPassword || newPassword.length < 6) {
      showToast(t("common.error"), "error");
      return;
    }

    setSaving(true);
    const { error } = await supabase.rpc("admin_reset_password", {
      p_user_id: resetUserId,
      p_new_password: newPassword,
    });
    setSaving(false);

    if (error) {
      showToast(t("common.error"), "error");
    } else {
      showToast(t("admin.passwordReset"), "success");
      logAction("reset_password", "user", resetUserId);
      setResetUserId(null);
      setNewPassword("");
    }
  }

  async function handleChangeRole(userId: string, newRole: string) {
    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", userId);

    if (error) {
      showToast(t("common.error"), "error");
    } else {
      showToast(t("admin.changeRole"), "success");
      logAction("change_role", "user", userId, { to: newRole });
      setChangingRoleUserId(null);
      loadData();
    }
  }

  async function handleCreatePerson() {
    if (
      !form.phone ||
      !/^\d{8,15}$/.test(form.phone) ||
      !form.full_name ||
      !form.password ||
      form.password.length < 6
    ) {
      showToast(t("common.error"), "error");
      return;
    }

    setCreating(true);
    const { error } = await supabase.rpc("admin_create_user", {
      p_phone: form.phone,
      p_full_name: form.full_name,
      p_gender: form.gender,
      p_password: form.password,
      p_role: form.role,
      p_has_wheelchair: form.has_wheelchair,
      p_sector_id: form.sector_id || null,
    });
    setCreating(false);

    if (error) {
      if (error.message.includes("unique") || error.message.includes("already")) {
        showToast(t("auth.phoneExists"), "error");
      } else {
        showToast(t("common.error"), "error");
      }
      return;
    }

    showToast(getRoleLabel(form.role, t) + " ✓", "success");
    logAction("create_user", "user", undefined, { phone: form.phone, role: form.role });
    setShowForm(false);
    setForm(emptyPersonForm);
    loadData();
  }

  async function handleDeleteUser(userId: string, userName: string) {
    if (!confirm(t("admin.confirmDeleteUser"))) return;

    const { error } = await supabase.rpc("admin_delete_user", {
      p_user_id: userId,
    });

    if (error) {
      showToast(t("common.error"), "error");
    } else {
      showToast(t("admin.userDeleted"), "success");
      logAction("delete_user", "user", userId, { name: userName });
      loadData();
    }
  }

  function startEditCar(user: Profile) {
    setEditingCarUserId(user.id);
    setCarFormHasCar(user.has_car);
    setCarFormSeats(user.car_seats || 4);
  }

  async function handleSaveCar() {
    if (!editingCarUserId) return;

    setSavingCar(true);
    const { error } = await supabase.rpc("admin_update_car_settings", {
      p_user_id: editingCarUserId,
      p_has_car: carFormHasCar,
      p_car_seats: carFormHasCar ? carFormSeats : 0,
    });
    setSavingCar(false);

    if (error) {
      showToast(t("common.error"), "error");
    } else {
      showToast(t("cars.carSaved"), "success");
      logAction("update_car_settings", "user", editingCarUserId);
      setEditingCarUserId(null);
      loadData();
    }
  }

  const filtered = useMemo(() => users.filter((u) => {
    const matchesSearch = !search || u.full_name.includes(search) || u.phone.includes(search);
    const matchesRole = !roleFilter || u.role === roleFilter;
    const matchesSector = !sectorFilter || u.sector_id === sectorFilter;
    return matchesSearch && matchesRole && matchesSector;
  }), [users, search, roleFilter, sectorFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  );

  useEffect(() => { setPage(1); }, [search, roleFilter, sectorFilter]);

  if (loading) {
    return <LoadingSpinner text={t("common.loading")} />;
  }

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h1 className="section-title">{t("admin.userManagement")}</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary w-full sm:w-auto">
          + {t("admin.addPerson")}
        </button>
      </div>

      {showForm && (
        <div className="card mb-4 animate-slide-up">
          <h3 className="text-base font-bold text-slate-800 dark:text-gray-100 mb-3">+ {t("admin.addPerson")}</h3>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <div>
              <label className="label-text">{t("auth.phone")}</label>
              <input
                className="input-field"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="01XXXXXXXXX"
                dir="ltr"
              />
            </div>
            <div>
              <label className="label-text">{t("auth.fullName")}</label>
              <input
                className="input-field"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>
            <div>
              <label className="label-text">{t("auth.gender")}</label>
              <select
                className="input-field"
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value as "Male" | "Female" })}
              >
                <option value="Male">{t("auth.male")}</option>
                <option value="Female">{t("auth.female")}</option>
              </select>
            </div>
            <div>
              <label className="label-text">{t("admin.role")}</label>
              <select
                className="input-field"
                value={form.role}
                onChange={(e) => {
                  const newRole = e.target.value as UserRole;
                  setForm({ ...form, role: newRole, has_wheelchair: newRole === "patient" ? form.has_wheelchair : false });
                }}
              >
                {CREATABLE_ROLES.map((r) => (
                  <option key={r} value={r}>{getRoleLabel(r, t)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-text">{t("sectors.select")}</label>
              <select
                className="input-field"
                value={form.sector_id}
                onChange={(e) => setForm({ ...form, sector_id: e.target.value })}
              >
                <option value="">{t("sectors.none")}</option>
                {sectors.map((s) => (
                  <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-text">{t("auth.password")}</label>
              <input
                type="password"
                className="input-field"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                dir="ltr"
                placeholder="••••••••"
              />
            </div>
            {form.role === "patient" && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.has_wheelchair}
                  onClick={() => setForm({ ...form, has_wheelchair: !form.has_wheelchair })}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    form.has_wheelchair ? "bg-blue-600" : "bg-slate-200 dark:bg-gray-700"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      form.has_wheelchair ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
                <span className="text-sm text-slate-600 dark:text-gray-300">♿ {t("admin.wheelchair")}</span>
              </div>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <button onClick={handleCreatePerson} disabled={creating} className="btn-primary w-full sm:w-auto">
              {creating ? t("common.loading") : t("admin.addPerson")}
            </button>
            <button onClick={() => { setShowForm(false); setForm(emptyPersonForm); }} className="btn-secondary w-full sm:w-auto">
              {t("admin.cancel")}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          className="input-field flex-1 min-w-[140px] max-w-xs"
          placeholder={t("admin.searchUsers")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input-field w-auto min-w-[140px]"
          value={sectorFilter}
          onChange={(e) => setSectorFilter(e.target.value)}
        >
          <option value="">{t("sectors.all")}</option>
          {sectors.map((s) => (
            <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
          ))}
        </select>
        <div className="flex gap-1 flex-wrap">
          {["", ...ALL_ROLES].map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                roleFilter === r
                  ? "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400"
                  : "bg-slate-50 dark:bg-gray-800 text-slate-500 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700"
              }`}
            >
              {r === "" ? t("admin.all") : getRoleLabel(r, t)}
            </button>
          ))}
        </div>
      </div>

      {resetUserId && (
        <div className="card mb-4 animate-slide-up">
          <h3 className="text-base font-bold text-slate-800 dark:text-gray-100 mb-3">{t("admin.resetPassword")}</h3>
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
            <div className="flex-1">
              <label className="label-text">{t("admin.newPassword")}</label>
              <input
                type="password"
                className="input-field"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                dir="ltr"
                placeholder="••••••••"
              />
            </div>
            <button onClick={handleResetPassword} disabled={saving} className="btn-primary w-full sm:w-auto">
              {saving ? t("common.loading") : t("admin.resetPassword")}
            </button>
            <button onClick={() => { setResetUserId(null); setNewPassword(""); }} className="btn-secondary w-full sm:w-auto">
              {t("admin.cancel")}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {paginated.map((u) => (
          <div key={u.id} className="card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-slate-800 dark:text-gray-100 text-sm">{u.full_name}</span>
                <span className="text-xs text-slate-400 dark:text-gray-500" dir="ltr">{u.phone}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getRoleBadgeClasses(u.role)}`}>
                  {getRoleLabel(u.role, t)}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  u.gender === "Male" ? "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400" : "bg-pink-50 dark:bg-pink-950/30 text-pink-600 dark:text-pink-400"
                }`}>
                  {u.gender === "Male" ? t("auth.male") : t("auth.female")}
                </span>
                {u.sector_id && sectorMap.has(u.sector_id) && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-400">
                    {sectorMap.get(u.sector_id)!.name}
                  </span>
                )}
                {u.has_car && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-400" title={t("cars.title")}>
                    🚗 {u.car_seats || 0}
                  </span>
                )}
                {u.has_wheelchair && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400" title={t("admin.wheelchair")}>
                    ♿
                  </span>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                {u.role !== "super_admin" && (
                  <>
                    {changingRoleUserId === u.id ? (
                      <select
                        className="input-field !py-1 !text-xs !w-auto"
                        defaultValue={u.role}
                        onChange={(e) => handleChangeRole(u.id, e.target.value)}
                        onBlur={() => setChangingRoleUserId(null)}
                        autoFocus
                      >
                        {ALL_ROLES.filter((r) => r !== "super_admin").map((r) => (
                          <option key={r} value={r}>{getRoleLabel(r, t)}</option>
                        ))}
                      </select>
                    ) : (
                      <button
                        onClick={() => setChangingRoleUserId(u.id)}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-50 dark:bg-gray-800 text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700 active:scale-95 transition-all duration-150"
                      >
                        {t("admin.changeRole")}
                      </button>
                    )}
                    {u.role === "servant" && (
                      <button
                        onClick={() => startEditCar(u)}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-cyan-50 dark:bg-cyan-950/30 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-100 dark:hover:bg-cyan-950/50 active:scale-95 transition-all duration-150"
                      >
                        {t("cars.editCar")}
                      </button>
                    )}
                    <button
                      onClick={() => setResetUserId(u.id)}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-950/50 active:scale-95 transition-all duration-150"
                    >
                      {t("admin.resetPassword")}
                    </button>
                    <button
                      onClick={() => handleDeleteUser(u.id, u.full_name)}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/50 active:scale-95 transition-all duration-150"
                    >
                      {t("common.delete")}
                    </button>
                  </>
                )}
                {u.role === "super_admin" && (
                  <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded-lg">
                    {t("admin.protectedAccount")}
                  </span>
                )}
              </div>
              {editingCarUserId === u.id && (
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-gray-800 animate-slide-up">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={carFormHasCar}
                        onClick={() => setCarFormHasCar(!carFormHasCar)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          carFormHasCar ? "bg-blue-600" : "bg-slate-200 dark:bg-gray-700"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            carFormHasCar ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                      <span className="text-sm text-slate-600 dark:text-gray-300">{t("settings.hasCar")}</span>
                    </div>
                    {carFormHasCar && (
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-400 dark:text-gray-500">{t("settings.carSeats")}:</label>
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={carFormSeats}
                          onChange={(e) => setCarFormSeats(Math.max(1, parseInt(e.target.value) || 1))}
                          className="input-field !w-20 !py-1 !text-sm text-center"
                          dir="ltr"
                        />
                      </div>
                    )}
                    <div className="flex gap-2 ms-auto">
                      <button
                        onClick={handleSaveCar}
                        disabled={savingCar}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 active:scale-95 transition-all duration-150"
                      >
                        {savingCar ? t("common.loading") : t("common.save")}
                      </button>
                      <button
                        onClick={() => setEditingCarUserId(null)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-200 dark:bg-gray-700 text-slate-600 dark:text-gray-300 hover:bg-slate-300 dark:hover:bg-gray-600 active:scale-95 transition-all duration-150"
                      >
                        {t("admin.cancel")}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-slate-400 dark:text-gray-500 text-center py-4 text-sm">{t("admin.noUsers")}</p>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-50 dark:bg-gray-800 hover:bg-slate-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-all duration-150"
            >
              ←
            </button>
            <span className="text-sm text-slate-500 dark:text-gray-400">{page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-50 dark:bg-gray-800 hover:bg-slate-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-all duration-150"
            >
              →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
