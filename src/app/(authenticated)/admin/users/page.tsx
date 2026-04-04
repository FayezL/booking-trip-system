"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useToast } from "@/components/Toast";
import LoadingSpinner from "@/components/LoadingSpinner";
import { logAction } from "@/lib/admin-logs";
import type { Profile } from "@/lib/types/database";

type ServantForm = {
  phone: string;
  full_name: string;
  gender: "Male" | "Female";
  password: string;
};

const emptyServantForm: ServantForm = {
  phone: "",
  full_name: "",
  gender: "Male",
  password: "",
};

export default function UsersPage() {
  const { t } = useTranslation();
  const supabase = createClient();
  const { showToast } = useToast();

  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [showServantForm, setShowServantForm] = useState(false);
  const [servantForm, setServantForm] = useState<ServantForm>(emptyServantForm);
  const [creatingServant, setCreatingServant] = useState(false);
  const [page, setPage] = useState(1);

  const PAGE_SIZE = 20;

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    setUsers(data || []);
    setLoading(false);
  }

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

  async function handleChangeRole(userId: string, currentRole: string) {
    const newRole = currentRole === "patient" ? "servant" : "patient";
    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", userId);

    if (error) {
      showToast(t("common.error"), "error");
    } else {
      showToast(t("admin.changeRole"), "success");
      logAction("change_role", "user", userId, { from: currentRole, to: newRole });
      loadUsers();
    }
  }

  async function handleCreateServant() {
    if (
      !servantForm.phone ||
      !/^\d{8,15}$/.test(servantForm.phone) ||
      !servantForm.full_name ||
      !servantForm.password ||
      servantForm.password.length < 6
    ) {
      showToast(t("common.error"), "error");
      return;
    }

    setCreatingServant(true);
    const { error } = await supabase.rpc("admin_create_servant", {
      p_phone: servantForm.phone,
      p_full_name: servantForm.full_name,
      p_gender: servantForm.gender,
      p_password: servantForm.password,
    });
    setCreatingServant(false);

    if (error) {
      if (error.message.includes("unique") || error.message.includes("already")) {
        showToast(t("auth.phoneExists"), "error");
      } else {
        showToast(t("common.error"), "error");
      }
      return;
    }

    showToast(t("admin.servant") + " ✓", "success");
    logAction("create_servant", "user", undefined, { phone: servantForm.phone });
    setShowServantForm(false);
    setServantForm(emptyServantForm);
    loadUsers();
  }

  const filtered = useMemo(() => users.filter((u) => {
    const matchesSearch = !search || u.full_name.includes(search) || u.phone.includes(search);
    const matchesRole = !roleFilter || u.role === roleFilter;
    return matchesSearch && matchesRole;
  }), [users, search, roleFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  );

  useEffect(() => { setPage(1); }, [search, roleFilter]);

  if (loading) {
    return <LoadingSpinner text={t("common.loading")} />;
  }

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h1 className="section-title">{t("admin.userManagement")}</h1>
        <button onClick={() => setShowServantForm(!showServantForm)} className="btn-primary w-full sm:w-auto">
          + {t("admin.addServant")}
        </button>
      </div>

      {showServantForm && (
        <div className="card mb-4 animate-slide-up">
          <h3 className="text-base font-bold text-slate-800 dark:text-gray-100 mb-3">+ {t("admin.addServant")}</h3>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <div>
              <label className="label-text">{t("auth.phone")}</label>
              <input
                className="input-field"
                value={servantForm.phone}
                onChange={(e) => setServantForm({ ...servantForm, phone: e.target.value })}
                placeholder="01XXXXXXXXX"
                dir="ltr"
              />
            </div>
            <div>
              <label className="label-text">{t("auth.fullName")}</label>
              <input
                className="input-field"
                value={servantForm.full_name}
                onChange={(e) => setServantForm({ ...servantForm, full_name: e.target.value })}
              />
            </div>
            <div>
              <label className="label-text">{t("auth.gender")}</label>
              <select
                className="input-field"
                value={servantForm.gender}
                onChange={(e) => setServantForm({ ...servantForm, gender: e.target.value as "Male" | "Female" })}
              >
                <option value="Male">{t("auth.male")}</option>
                <option value="Female">{t("auth.female")}</option>
              </select>
            </div>
            <div>
              <label className="label-text">{t("auth.password")}</label>
              <input
                type="password"
                className="input-field"
                value={servantForm.password}
                onChange={(e) => setServantForm({ ...servantForm, password: e.target.value })}
                dir="ltr"
                placeholder="••••••••"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <button onClick={handleCreateServant} disabled={creatingServant} className="btn-primary w-full sm:w-auto">
              {creatingServant ? t("common.loading") : t("admin.addServant")}
            </button>
            <button onClick={() => { setShowServantForm(false); setServantForm(emptyServantForm); }} className="btn-secondary w-full sm:w-auto">
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
        <div className="flex gap-1 flex-wrap">
          {["", "super_admin", "servant", "patient"].map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                roleFilter === r
                  ? "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400"
                  : "bg-slate-50 dark:bg-gray-800 text-slate-500 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700"
              }`}
            >
              {r === "" ? t("admin.all") : r === "super_admin" ? t("admin.superAdmin") : t(`admin.${r}`)}
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
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  u.role === "super_admin" ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400" :
                  u.role === "servant" ? "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400" :
                  "bg-slate-50 dark:bg-gray-800 text-slate-600 dark:text-gray-400"
                }`}>
                  {u.role === "super_admin" ? t("admin.superAdmin") :
                   u.role === "servant" ? t("admin.servant") : t("admin.patient")}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  u.gender === "Male" ? "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400" : "bg-pink-50 dark:bg-pink-950/30 text-pink-600 dark:text-pink-400"
                }`}>
                  {u.gender === "Male" ? t("auth.male") : t("auth.female")}
                </span>
              </div>
              <div className="flex gap-2">
                {u.role !== "super_admin" && (
                  <>
                    <button
                      onClick={() => handleChangeRole(u.id, u.role)}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-50 dark:bg-gray-800 text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700 active:scale-95 transition-all duration-150"
                    >
                      {u.role === "patient" ? t("admin.servant") : t("admin.patient")}
                    </button>
                    <button
                      onClick={() => setResetUserId(u.id)}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-950/50 active:scale-95 transition-all duration-150"
                    >
                      {t("admin.resetPassword")}
                    </button>
                  </>
                )}
                {u.role === "super_admin" && (
                  <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded-lg">
                    {t("admin.protectedAccount")}
                  </span>
                )}
              </div>
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
