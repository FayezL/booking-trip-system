"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useToast } from "@/components/Toast";
import LoadingSpinner from "@/components/LoadingSpinner";
import { logAction } from "@/lib/admin-logs";
import UserDetailModal from "./UserDetailModal";
import type { Profile, Sector, FamilyMember } from "@/lib/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import Toggle from "@/components/Toggle";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Users, Search, Plus, Edit, Trash2, Car, Phone, ChevronLeft, ChevronRight } from "lucide-react";

type UserRole = "admin" | "servant" | "patient" | "companion" | "family_assistant" | "trainee";

type PersonForm = {
  phone: string;
  full_name: string;
  gender: "Male" | "Female";
  password: string;
  role: UserRole;
  has_wheelchair: boolean;
  sector_id: string;
  transport_type: "private" | "bus";
  servants_needed: 0 | 1 | 2;
};

const emptyPersonForm: PersonForm = {
  phone: "",
  full_name: "",
  gender: "Male",
  password: "",
  role: "patient",
  has_wheelchair: false,
  sector_id: "",
  transport_type: "bus",
  servants_needed: 0,
};

const ALL_ROLES: ("super_admin" | UserRole)[] = ["super_admin", "admin", "servant", "patient", "companion", "family_assistant", "trainee"];
const CREATABLE_ROLES: UserRole[] = ["admin", "patient", "companion", "family_assistant", "trainee"];

function getRoleLabel(role: string, t: (key: string) => string): string {
  switch (role) {
    case "super_admin": return t("admin.superAdmin");
    case "admin": return t("admin.adminRole");
    case "servant": return t("admin.servant");
    case "patient": return t("admin.patient");
    case "companion": return t("admin.companion");
    case "family_assistant": return t("admin.familyAssistant");
    case "trainee": return t("admin.trainee");
    default: return role;
  }
}

function getRoleBadgeVariant(role: string): "default" | "secondary" | "destructive" | "outline" {
  switch (role) {
    case "super_admin": return "destructive";
    case "admin": return "default";
    case "servant": return "secondary";
    case "family_assistant": return "outline";
    default: return "outline";
  }
}

function getRoleBadgeClassName(role: string): string {
  switch (role) {
    case "super_admin": return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 hover:bg-amber-100";
    case "admin": return "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 hover:bg-blue-100";
    case "servant": return "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 hover:bg-indigo-100";
    case "patient": return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-100";
    case "companion": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 hover:bg-emerald-100";
    case "family_assistant": return "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 hover:bg-purple-100";
    case "trainee": return "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400 hover:bg-orange-100";
    default: return "";
  }
}

function getInitials(name: string): string {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
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
  const [detailUserId, setDetailUserId] = useState<string | null>(null);

  const [familyCounts, setFamilyCounts] = useState<Record<string, number>>({});
  const [managingFamilyId, setManagingFamilyId] = useState<string | null>(null);
  const [familyList, setFamilyList] = useState<FamilyMember[]>([]);
  const [showFmForm, setShowFmForm] = useState(false);
  const [fmForm, setFmForm] = useState({ full_name: "", gender: "Male" as "Male" | "Female", has_wheelchair: false });
  const [editingFmId, setEditingFmId] = useState<string | null>(null);
  const [savingFm, setSavingFm] = useState(false);

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
      const usersData = (usersRes.data || []) as Profile[];
      setUsers(usersData);
      setSectors((sectorsRes.data || []) as Sector[]);

      const counts: Record<string, number> = {};
      const { data: fmAll } = await supabase.from("family_members").select("head_user_id");
      for (const fm of (fmAll || []) as { head_user_id: string }[]) {
        counts[fm.head_user_id] = (counts[fm.head_user_id] || 0) + 1;
      }
      setFamilyCounts(counts);
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
      p_transport_type: form.transport_type,
      p_servants_needed: form.servants_needed,
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

  async function openFamilyManager(userId: string) {
    if (managingFamilyId === userId) {
      setManagingFamilyId(null);
      return;
    }
    setManagingFamilyId(userId);
    setShowFmForm(false);
    setEditingFmId(null);
    const { data } = await supabase.rpc("get_family_members", { p_user_id: userId });
    setFamilyList((data || []) as FamilyMember[]);
  }

  function startAddFm() {
    setEditingFmId(null);
    setFmForm({ full_name: "", gender: "Male", has_wheelchair: false });
    setShowFmForm(true);
  }

  function startEditFm(member: FamilyMember) {
    setEditingFmId(member.id);
    setFmForm({ full_name: member.full_name, gender: member.gender, has_wheelchair: member.has_wheelchair });
    setShowFmForm(true);
  }

  async function handleSaveFm() {
    if (!fmForm.full_name.trim() || !managingFamilyId) return;
    setSavingFm(true);
    if (editingFmId) {
      const { error } = await supabase.rpc("update_family_member", {
        p_member_id: editingFmId,
        p_full_name: fmForm.full_name.trim(),
        p_gender: fmForm.gender,
        p_has_wheelchair: fmForm.has_wheelchair,
      });
      setSavingFm(false);
      if (error) { showToast(t("common.error"), "error"); return; }
      showToast(t("family.memberUpdated"), "success");
    } else {
      const { error } = await supabase.rpc("add_family_member", {
        p_head_user_id: managingFamilyId,
        p_full_name: fmForm.full_name.trim(),
        p_gender: fmForm.gender,
        p_has_wheelchair: fmForm.has_wheelchair,
      });
      setSavingFm(false);
      if (error) { showToast(t("common.error"), "error"); return; }
      showToast(t("family.memberAdded"), "success");
    }
    setShowFmForm(false);
    const { data } = await supabase.rpc("get_family_members", { p_user_id: managingFamilyId });
    setFamilyList((data || []) as FamilyMember[]);
    loadData();
  }

  async function handleRemoveFm(memberId: string) {
    if (!confirm(t("family.confirmRemove"))) return;
    const { error } = await supabase.rpc("remove_family_member", { p_member_id: memberId });
    if (error) { showToast(t("common.error"), "error"); return; }
    showToast(t("family.memberRemoved"), "success");
    const { data } = await supabase.rpc("get_family_members", { p_user_id: managingFamilyId! });
    setFamilyList((data || []) as FamilyMember[]);
    loadData();
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
    <div className="animate-fade-in space-y-4">
      {detailUserId && (
        <UserDetailModal
          userId={detailUserId}
          onClose={() => setDetailUserId(null)}
        />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          <h1 className="section-title">{t("admin.userManagement")}</h1>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
          <Plus className="h-4 w-4" />
          {t("admin.addPerson")}
        </Button>
      </div>

      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) setForm(emptyPersonForm); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              {t("admin.addPerson")}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("auth.phone")}</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="01XXXXXXXXX"
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("auth.fullName")}</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("auth.gender")}</Label>
              <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v as "Male" | "Female" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">{t("auth.male")}</SelectItem>
                  <SelectItem value="Female">{t("auth.female")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("admin.role")}</Label>
              <Select value={form.role} onValueChange={(v) => {
                const newRole = v as UserRole;
                setForm({ ...form, role: newRole, has_wheelchair: newRole === "patient" ? form.has_wheelchair : false });
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CREATABLE_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{getRoleLabel(r, t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("sectors.select")}</Label>
              <Select value={form.sector_id || "__none__"} onValueChange={(v) => setForm({ ...form, sector_id: v === "__none__" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("sectors.none")}</SelectItem>
                  {sectors.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.code} - {s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("auth.password")}</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                dir="ltr"
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("admin.transportType")}</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={form.transport_type === "private" ? "default" : "outline"}
                  onClick={() => setForm({ ...form, transport_type: "private" })}
                  className="flex-1 min-h-[40px]"
                >
                  {t("admin.transportPrivate")}
                </Button>
                <Button
                  type="button"
                  variant={form.transport_type === "bus" ? "default" : "outline"}
                  onClick={() => setForm({ ...form, transport_type: "bus" })}
                  className="flex-1 min-h-[40px]"
                >
                  {t("admin.transportBus")}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("admin.servantsNeeded")}</Label>
              <div className="flex gap-2">
                {([0, 1, 2] as const).map((n) => (
                  <Button
                    key={n}
                    type="button"
                    variant={form.servants_needed === n ? "default" : "outline"}
                    onClick={() => setForm({ ...form, servants_needed: n })}
                    className="flex-1 min-h-[40px]"
                  >
                    {n}
                  </Button>
                ))}
              </div>
            </div>
            {form.role === "patient" && (
              <div className="flex items-center gap-3 md:col-span-2">
                <Toggle
                  checked={form.has_wheelchair}
                  onChange={(v) => setForm({ ...form, has_wheelchair: v })}
                />
                <Label>{t("admin.wheelchair")}</Label>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button onClick={handleCreatePerson} disabled={creating}>
              {creating ? t("common.loading") : t("admin.addPerson")}
            </Button>
            <Button variant="outline" onClick={() => { setShowForm(false); setForm(emptyPersonForm); }}>
              {t("admin.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 min-w-[140px] max-w-xs">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("admin.searchUsers")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pe-9"
              />
            </div>
            <Select value={sectorFilter || "__all__"} onValueChange={(v) => setSectorFilter(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-auto min-w-[160px]">
                <SelectValue placeholder={t("sectors.all")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{t("sectors.all")}</SelectItem>
                {sectors.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.code} - {s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-1 flex-wrap">
              {["", ...ALL_ROLES].map((r) => (
                <Button
                  key={r}
                  variant={roleFilter === r ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setRoleFilter(r)}
                >
                  {r === "" ? t("admin.all") : getRoleLabel(r, t)}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {resetUserId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("admin.resetPassword")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
              <div className="flex-1 space-y-2">
                <Label>{t("admin.newPassword")}</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  dir="ltr"
                  placeholder="••••••••"
                />
              </div>
              <Button onClick={handleResetPassword} disabled={saving}>
                {saving ? t("common.loading") : t("admin.resetPassword")}
              </Button>
              <Button variant="outline" onClick={() => { setResetUserId(null); setNewPassword(""); }}>
                {t("admin.cancel")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {paginated.map((u) => (
          <Card key={u.id} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-5">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs font-semibold bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400">
                        {getInitials(u.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-foreground text-sm">{u.full_name}</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1" dir="ltr">
                      <Phone className="h-3 w-3" />
                      {u.phone}
                    </span>
                    <Badge className={cn("text-xs", getRoleBadgeClassName(u.role))} variant={getRoleBadgeVariant(u.role)}>
                      {getRoleLabel(u.role, t)}
                    </Badge>
                    <Badge variant="outline" className={cn(
                      "text-xs",
                      u.gender === "Male"
                        ? "border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400"
                        : "border-pink-300 text-pink-600 dark:border-pink-700 dark:text-pink-400"
                    )}>
                      {u.gender === "Male" ? t("auth.male") : t("auth.female")}
                    </Badge>
                    {u.sector_id && sectorMap.has(u.sector_id) && (
                      <Badge variant="outline" className="border-teal-300 text-teal-700 dark:border-teal-700 dark:text-teal-400 text-xs">
                        {sectorMap.get(u.sector_id)!.name}
                      </Badge>
                    )}
                    {u.has_car && (
                      <Badge variant="outline" className="border-cyan-300 text-cyan-700 dark:border-cyan-700 dark:text-cyan-400 text-xs gap-1">
                        <Car className="h-3 w-3" />
                        {u.car_seats || 0}
                      </Badge>
                    )}
                    {u.has_wheelchair && (
                      <Badge variant="outline" className="border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400 text-xs">
                        ♿
                      </Badge>
                    )}
                    {familyCounts[u.id] > 0 && (
                      <Badge variant="outline" className="border-purple-300 text-purple-700 dark:border-purple-700 dark:text-purple-400 text-xs gap-1">
                        <Users className="h-3 w-3" />
                        {familyCounts[u.id]}
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="ghost" size="sm" onClick={() => setDetailUserId(u.id)}>
                      {t("admin.viewDetails")}
                    </Button>
                    {u.role !== "super_admin" && (
                      <>
                        {changingRoleUserId === u.id ? (
                          <Select defaultValue={u.role} onValueChange={(v) => handleChangeRole(u.id, v)}>
                            <SelectTrigger className="h-8 w-auto min-w-[120px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ALL_ROLES.filter((r) => r !== "super_admin").map((r) => (
                                <SelectItem key={r} value={r}>{getRoleLabel(r, t)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => setChangingRoleUserId(u.id)}>
                            <Edit className="h-3 w-3 me-1" />
                            {t("admin.changeRole")}
                          </Button>
                        )}
                        {u.role === "servant" && (
                          <Button variant="ghost" size="sm" onClick={() => startEditCar(u)} className="text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300">
                            <Car className="h-3 w-3 me-1" />
                            {t("cars.editCar")}
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => setResetUserId(u.id)} className="text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300">
                          {t("admin.resetPassword")}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteUser(u.id, u.full_name)} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-3 w-3 me-1" />
                          {t("common.delete")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openFamilyManager(u.id)}
                          className={cn(
                            managingFamilyId === u.id
                              ? "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400"
                              : "text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
                          )}
                        >
                          <Users className="h-3 w-3 me-1" />
                          {t("family.title")}
                        </Button>
                      </>
                    )}
                    {u.role === "super_admin" && (
                      <Badge variant="outline" className="border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400">
                        {t("admin.protectedAccount")}
                      </Badge>
                    )}
                  </div>
                </div>

                {editingCarUserId === u.id && (
                  <>
                    <Separator />
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 animate-fade-in">
                      <div className="flex items-center gap-3">
                        <Toggle
                          checked={carFormHasCar}
                          onChange={setCarFormHasCar}
                        />
                        <Label className="text-sm">{t("settings.hasCar")}</Label>
                      </div>
                      {carFormHasCar && (
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-muted-foreground">{t("settings.carSeats")}:</Label>
                          <Input
                            type="number"
                            min="1"
                            max="20"
                            value={carFormSeats}
                            onChange={(e) => setCarFormSeats(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-20 text-center h-8"
                            dir="ltr"
                          />
                        </div>
                      )}
                      <div className="flex gap-2 ms-auto">
                        <Button size="sm" onClick={handleSaveCar} disabled={savingCar}>
                          {savingCar ? t("common.loading") : t("common.save")}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingCarUserId(null)}>
                          {t("admin.cancel")}
                        </Button>
                      </div>
                    </div>
                  </>
                )}

                {managingFamilyId === u.id && (
                  <>
                    <Separator />
                    <div className="space-y-3 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-foreground">{t("family.title")}</h4>
                        <Button size="sm" variant="outline" onClick={startAddFm} className="gap-1">
                          <Plus className="h-3 w-3" />
                          {t("family.add")}
                        </Button>
                      </div>

                      {showFmForm && (
                        <Card className="bg-muted/50">
                          <CardContent className="pt-4">
                            <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                              <Input
                                placeholder={t("family.name")}
                                value={fmForm.full_name}
                                onChange={(e) => setFmForm({ ...fmForm, full_name: e.target.value })}
                              />
                              <Select value={fmForm.gender} onValueChange={(v) => setFmForm({ ...fmForm, gender: v as "Male" | "Female" })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Male">{t("family.male")}</SelectItem>
                                  <SelectItem value="Female">{t("family.female")}</SelectItem>
                                </SelectContent>
                              </Select>
                              <div className="flex items-center gap-2">
                                <Toggle
                                  checked={fmForm.has_wheelchair}
                                  onChange={(v) => setFmForm({ ...fmForm, has_wheelchair: v })}
                                  size="sm"
                                />
                                <Label className="text-xs">♿</Label>
                              </div>
                            </div>
                            <div className="flex gap-2 mt-3">
                              <Button size="sm" onClick={handleSaveFm} disabled={savingFm || !fmForm.full_name.trim()}>
                                {savingFm ? t("common.loading") : t("common.save")}
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setShowFmForm(false)}>
                                {t("admin.cancel")}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {familyList.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-2">{t("family.noMembers")}</p>
                      ) : (
                        <div className="space-y-1">
                          {familyList.map((fm, idx) => (
                            <div key={fm.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">{idx + 1}.</span>
                                <span className="text-sm font-medium text-foreground">{fm.full_name}</span>
                                <Badge variant="outline" className={cn(
                                  "text-xs",
                                  fm.gender === "Male" ? "border-blue-300 text-blue-500" : "border-pink-300 text-pink-500"
                                )}>
                                  {fm.gender === "Male" ? "♂" : "♀"}
                                </Badge>
                                {fm.has_wheelchair && (
                                  <Badge variant="outline" className="text-xs border-amber-300 text-amber-600">♿</Badge>
                                )}
                              </div>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => startEditFm(fm)}>
                                  {t("common.edit")}
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => handleRemoveFm(fm.id)}>
                                  {t("common.delete")}
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="text-muted-foreground text-center py-4 text-sm">{t("admin.noUsers")}</p>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
