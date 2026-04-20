"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useToast } from "@/components/Toast";
import LoadingSpinner from "@/components/LoadingSpinner";
import { logAction } from "@/lib/admin-logs";
import type { Sector } from "@/lib/types/database";

type SectorForm = {
  name: string;
  code: string;
  sort_order: number;
  is_active: boolean;
};

const emptyForm: SectorForm = {
  name: "",
  code: "",
  sort_order: 0,
  is_active: true,
};

export default function SectorsPage() {
  const { t } = useTranslation();
  const supabase = createClient();
  const { showToast } = useToast();

  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SectorForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadSectors = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("sectors")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      setSectors((data || []) as Sector[]);
    } catch {
      showToast(t("common.error"), "error");
    } finally {
      setLoading(false);
    }
  }, [supabase, showToast, t]);

  useEffect(() => {
    loadSectors();
  }, [loadSectors]);

  function startCreate() {
    setEditingId(null);
    setForm({ ...emptyForm, sort_order: sectors.length + 1 });
    setShowForm(true);
  }

  function startEdit(sector: Sector) {
    setEditingId(sector.id);
    setForm({
      name: sector.name,
      code: sector.code,
      sort_order: sector.sort_order,
      is_active: sector.is_active,
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.code.trim()) {
      showToast(t("common.error"), "error");
      return;
    }

    setSaving(true);

    try {
      if (editingId) {
        const { error } = await supabase
          .from("sectors")
          .update({
            name: form.name.trim(),
            code: form.code.trim(),
            sort_order: form.sort_order,
            is_active: form.is_active,
          })
          .eq("id", editingId);
        if (error) throw error;
        logAction("edit_sector", "sector", editingId, { name: form.name });
      } else {
        const { error } = await supabase
          .from("sectors")
          .insert({
            name: form.name.trim(),
            code: form.code.trim(),
            sort_order: form.sort_order,
            is_active: form.is_active,
          });
        if (error) throw error;
        logAction("create_sector", "sector", undefined, { name: form.name });
      }

      showToast(t("sectors.sectorSaved"), "success");
      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);
      loadSectors();
    } catch {
      showToast(t("common.error"), "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(t("sectors.confirmDelete"))) return;

    const { error } = await supabase.from("sectors").delete().eq("id", id);

    if (error) {
      showToast(t("common.error"), "error");
    } else {
      showToast(t("sectors.sectorDeleted"), "success");
      logAction("delete_sector", "sector", id, { name });
      if (editingId === id) {
        setShowForm(false);
        setForm(emptyForm);
        setEditingId(null);
      }
      loadSectors();
    }
  }

  async function toggleActive(sector: Sector) {
    const { error } = await supabase
      .from("sectors")
      .update({ is_active: !sector.is_active })
      .eq("id", sector.id);

    if (error) {
      showToast(t("common.error"), "error");
    } else {
      logAction("toggle_sector", "sector", sector.id, { active: !sector.is_active });
      loadSectors();
    }
  }

  if (loading) {
    return <LoadingSpinner text={t("common.loading")} />;
  }

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h1 className="section-title">{t("sectors.manage")}</h1>
        <button onClick={startCreate} className="btn-primary w-full sm:w-auto">
          + {t("sectors.add")}
        </button>
      </div>

      {showForm && (
        <div className="card mb-4 animate-slide-up">
          <h3 className="text-base font-bold text-slate-800 dark:text-gray-100 mb-3">
            {editingId ? t("sectors.edit") : "+ " + t("sectors.add")}
          </h3>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <div>
              <label className="label-text">{t("sectors.code")}</label>
              <input
                className="input-field"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.replace(/[^0-9]/g, "").slice(0, 4) })}
                placeholder="01"
                dir="ltr"
                disabled={saving}
              />
            </div>
            <div>
              <label className="label-text">{t("sectors.name")}</label>
              <input
                className="input-field"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                disabled={saving}
              />
            </div>
            <div>
              <label className="label-text">{t("sectors.sortOrder")}</label>
              <input
                type="number"
                className="input-field"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value, 10) || 0 })}
                dir="ltr"
                disabled={saving}
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={form.is_active}
                onClick={() => setForm({ ...form, is_active: !form.is_active })}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  form.is_active ? "bg-blue-600" : "bg-slate-200 dark:bg-gray-700"
                }`}
                disabled={saving}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    form.is_active ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
              <span className="text-sm text-slate-600 dark:text-gray-300">
                {form.is_active ? t("sectors.active") : t("sectors.inactive")}
              </span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <button onClick={handleSave} disabled={saving} className="btn-primary w-full sm:w-auto">
              {saving ? t("common.loading") : t("common.save")}
            </button>
            <button
              onClick={() => { setShowForm(false); setForm(emptyForm); setEditingId(null); }}
              className="btn-secondary w-full sm:w-auto"
            >
              {t("admin.cancel")}
            </button>
          </div>
        </div>
      )}

      {sectors.length === 0 ? (
        <p className="text-slate-400 dark:text-gray-500 text-center py-8 text-sm">
          {t("sectors.noSectors")}
        </p>
      ) : (
        <div className="space-y-2">
          {sectors.map((sector) => (
            <div key={sector.id} className="card">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-mono font-bold text-slate-400 dark:text-gray-500 w-6 text-center">
                    {sector.code}
                  </span>
                  <span className="font-medium text-slate-800 dark:text-gray-100 text-sm">
                    {sector.name}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium cursor-pointer select-none transition-all duration-150 active:scale-95 ${
                      sector.is_active
                        ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400"
                        : "bg-slate-100 dark:bg-gray-800 text-slate-400 dark:text-gray-500 line-through"
                    }`}
                    onClick={() => toggleActive(sector)}
                    role="button"
                    tabIndex={0}
                    title={t("admin.toggleActive")}
                  >
                    {sector.is_active ? t("sectors.active") : t("sectors.inactive")}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => startEdit(sector)}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-50 dark:bg-gray-800 text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700 active:scale-95 transition-all duration-150"
                  >
                    {t("sectors.edit")}
                  </button>
                  <button
                    onClick={() => handleDelete(sector.id, sector.name)}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/50 active:scale-95 transition-all duration-150"
                  >
                    {t("common.delete")}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
