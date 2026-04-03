"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useToast } from "@/components/Toast";
import LoadingSpinner from "@/components/LoadingSpinner";
import { logAction } from "@/lib/admin-logs";
import type { Profile } from "@/lib/types/database";

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
    <div>
      <h1 className="text-2xl font-bold mb-6">{t("admin.userManagement")}</h1>

      <div className="flex gap-3 mb-4">
        <input
          className="input-field max-w-xs"
          placeholder={t("admin.searchUsers")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-1">
          {["", "super_admin", "servant", "patient"].map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                roleFilter === r
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {r === "" ? t("admin.all") : r === "super_admin" ? t("admin.superAdmin") : t(`admin.${r}`)}
            </button>
          ))}
        </div>
      </div>

      {resetUserId && (
        <div className="card mb-4">
          <h3 className="text-lg font-bold mb-3">{t("admin.resetPassword")}</h3>
          <div className="flex gap-3 items-end">
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
            <button onClick={handleResetPassword} disabled={saving} className="btn-primary">
              {saving ? t("common.loading") : t("admin.resetPassword")}
            </button>
            <button onClick={() => { setResetUserId(null); setNewPassword(""); }} className="btn-secondary">
              {t("admin.cancel")}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {paginated.map((u) => (
          <div key={u.id} className="card">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="font-medium">{u.full_name}</span>
                <span className="text-sm text-gray-500 ms-2" dir="ltr">{u.phone}</span>
                <span className={`text-xs px-2 py-0.5 rounded ms-2 ${
                  u.role === "super_admin" ? "bg-yellow-100 text-yellow-700" :
                  u.role === "servant" ? "bg-blue-100 text-blue-700" :
                  "bg-gray-100 text-gray-700"
                }`}>
                  {u.role === "super_admin" ? t("admin.superAdmin") :
                   u.role === "servant" ? t("admin.servant") : t("admin.patient")}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded ms-1 ${
                  u.gender === "Male" ? "bg-blue-50 text-blue-600" : "bg-pink-50 text-pink-600"
                }`}>
                  {u.gender === "Male" ? t("auth.male") : t("auth.female")}
                </span>
              </div>
              <div className="flex gap-2">
                {u.role !== "super_admin" && (
                  <>
                    <button
                      onClick={() => handleChangeRole(u.id, u.role)}
                      className="px-3 py-1.5 rounded-md text-sm font-medium bg-blue-100 text-blue-700 hover:bg-blue-200"
                    >
                      {u.role === "patient" ? t("admin.servant") : t("admin.patient")}
                    </button>
                    <button
                      onClick={() => setResetUserId(u.id)}
                      className="px-3 py-1.5 rounded-md text-sm font-medium bg-orange-100 text-orange-700 hover:bg-orange-200"
                    >
                      {t("admin.resetPassword")}
                    </button>
                  </>
                )}
                {u.role === "super_admin" && (
                  <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded">
                    {t("admin.protectedAccount")}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-gray-500 text-center py-4">{t("admin.noUsers")}</p>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-md text-sm font-medium bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
            >
              ←
            </button>
            <span className="text-sm text-gray-600">{page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-md text-sm font-medium bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
            >
              →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
