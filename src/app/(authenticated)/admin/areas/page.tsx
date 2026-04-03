"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useToast } from "@/components/Toast";
import LoadingSpinner from "@/components/LoadingSpinner";
import { logAction } from "@/lib/admin-logs";
import type { Area } from "@/lib/types/database";

type AreaForm = {
  name_ar: string;
  name_en: string;
  sort_order: number;
};

const emptyForm: AreaForm = {
  name_ar: "",
  name_en: "",
  sort_order: 0,
};

export default function AreasPage() {
  const { t } = useTranslation();
  const supabase = createClient();
  const { showToast } = useToast();

  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AreaForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAreas();
  }, []);

  async function loadAreas() {
    const { data } = await supabase
      .from("areas")
      .select("*")
      .order("sort_order")
      .order("created_at");
    setAreas(data || []);
    setLoading(false);
  }

  function startEdit(area: Area) {
    setEditingId(area.id);
    setForm({
      name_ar: area.name_ar,
      name_en: area.name_en,
      sort_order: area.sort_order,
    });
    setShowForm(true);
  }

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name_ar || !form.name_en) {
      showToast(t("common.error"), "error");
      return;
    }

    setSaving(true);

    if (editingId) {
      const { error } = await supabase
        .from("areas")
        .update(form)
        .eq("id", editingId);
      if (error) {
        showToast(t("common.error"), "error");
      } else {
        showToast(t("admin.editArea"), "success");
        logAction("edit_area", "area", editingId);
      }
    } else {
      const { error } = await supabase.from("areas").insert(form);
      if (error) {
        showToast(t("common.error"), "error");
      } else {
        showToast(t("admin.createArea"), "success");
        logAction("create_area", "area");
      }
    }

    setSaving(false);
    setShowForm(false);
    loadAreas();
  }

  async function handleDelete(id: string) {
    const { data } = await supabase
      .from("buses")
      .select("id")
      .eq("area_id", id)
      .limit(1);
    if (data && data.length > 0) {
      showToast(t("admin.areaInUse"), "error");
      return;
    }

    if (!confirm(t("admin.confirmDelete"))) return;
    const { error } = await supabase.from("areas").delete().eq("id", id);
    if (error) showToast(t("common.error"), "error");
    else {
      showToast(t("admin.deleteArea"), "success");
      logAction("delete_area", "area", id);
      loadAreas();
    }
  }

  async function handleToggle(area: Area) {
    const { error } = await supabase
      .from("areas")
      .update({ is_active: !area.is_active })
      .eq("id", area.id);
    if (error) showToast(t("common.error"), "error");
    else {
      logAction("toggle_area", "area", area.id, { is_active: !area.is_active });
      loadAreas();
    }
  }

  if (loading) {
    return <LoadingSpinner text={t("common.loading")} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">{t("admin.areas")}</h1>
        <button onClick={startCreate} className="btn-primary">
          + {t("admin.createArea")}
        </button>
      </div>

      {showForm && (
        <div className="card mb-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="label-text">{t("admin.areaNameAr")}</label>
              <input
                className="input-field"
                value={form.name_ar}
                onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
              />
            </div>
            <div>
              <label className="label-text">{t("admin.areaNameEn")}</label>
              <input
                className="input-field"
                value={form.name_en}
                onChange={(e) => setForm({ ...form, name_en: e.target.value })}
                dir="ltr"
              />
            </div>
            <div>
              <label className="label-text">{t("admin.sortOrder")}</label>
              <input
                type="number"
                className="input-field"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
                dir="ltr"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? t("common.loading") : t("admin.save")}
            </button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">
              {t("admin.cancel")}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {areas.map((area) => (
          <div key={area.id} className="card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <h3 className="text-lg font-bold">{area.name_ar}</h3>
                  <p className="text-sm text-gray-500" dir="ltr">{area.name_en}</p>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    area.is_active
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {area.is_active ? t("admin.areaActive") : t("admin.areaInactive")}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleToggle(area)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                    area.is_active
                      ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                      : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                  }`}
                >
                  {t("admin.toggleActive")}
                </button>
                <button
                  onClick={() => startEdit(area)}
                  className="px-3 py-1.5 rounded-md text-sm font-medium bg-blue-100 text-blue-700 hover:bg-blue-200"
                >
                  {t("common.edit")}
                </button>
                <button
                  onClick={() => handleDelete(area.id)}
                  className="px-3 py-1.5 rounded-md text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200"
                >
                  {t("common.delete")}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
