"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useToast } from "@/components/Toast";
import LoadingSpinner from "@/components/LoadingSpinner";
import { logAction } from "@/lib/admin-logs";
import type { Sector } from "@/lib/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { MapPin, Plus, Edit, Trash2 } from "lucide-react";

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
    <div className="animate-fade-in space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          <h1 className="section-title">{t("sectors.manage")}</h1>
        </div>
        <Button onClick={startCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          {t("sectors.add")}
        </Button>
      </div>

      <Dialog open={showForm} onOpenChange={(open) => {
        setShowForm(open);
        if (!open) { setForm(emptyForm); setEditingId(null); }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingId ? <Edit className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
              {editingId ? t("sectors.edit") : t("sectors.add")}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("sectors.code")}</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.replace(/[^0-9]/g, "").slice(0, 4) })}
                placeholder="01"
                dir="ltr"
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("sectors.name")}</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("sectors.sortOrder")}</Label>
              <Input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value, 10) || 0 })}
                dir="ltr"
                disabled={saving}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
                disabled={saving}
              />
              <Label className="text-sm">
                {form.is_active ? t("sectors.active") : t("sectors.inactive")}
              </Label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? t("common.loading") : t("common.save")}
            </Button>
            <Button variant="outline" onClick={() => { setShowForm(false); setForm(emptyForm); setEditingId(null); }}>
              {t("admin.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {sectors.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-muted-foreground text-center text-sm">
              {t("sectors.noSectors")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sectors.map((sector) => (
            <Card key={sector.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-mono font-bold text-muted-foreground bg-muted px-2 py-1 rounded">
                      {sector.code}
                    </span>
                    <span className="font-medium text-foreground text-sm">
                      {sector.name}
                    </span>
                    <Switch
                      checked={sector.is_active}
                      onCheckedChange={() => toggleActive(sector)}
                    />
                    <Badge
                      variant={sector.is_active ? "default" : "secondary"}
                      className={cn(
                        "text-xs cursor-default",
                        sector.is_active
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 hover:bg-emerald-100"
                          : ""
                      )}
                    >
                      {sector.is_active ? t("sectors.active") : t("sectors.inactive")}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => startEdit(sector)} className="gap-1">
                      <Edit className="h-3 w-3" />
                      {t("sectors.edit")}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(sector.id, sector.name)} className="text-destructive hover:text-destructive gap-1">
                      <Trash2 className="h-3 w-3" />
                      {t("common.delete")}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
