"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useToast } from "@/components/Toast";
import { logAction } from "@/lib/admin-logs";
import type { Profile } from "@/lib/types/database";
import PageBreadcrumbs from "@/components/PageBreadcrumbs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, Pencil, Trash2, KeyRound, Shield } from "lucide-react";

type UserRole = "admin" | "servant" | "patient" | "companion" | "family_assistant";

type PersonForm = {
  phone: string;
  full_name: string;
  gender: "Male" | "Female";
  password: string;
  role: UserRole;
  has_wheelchair: boolean;
};

const emptyPersonForm: PersonForm = {
  phone: "",
  full_name: "",
  gender: "Male",
  password: "",
  role: "patient",
  has_wheelchair: false,
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

function getRoleBadgeVariant(role: string): "default" | "secondary" | "destructive" | "outline" {
  switch (role) {
    case "super_admin": return "default";
    case "admin": return "secondary";
    case "servant": return "outline";
    case "patient": return "secondary";
    case "companion": return "outline";
    case "family_assistant": return "secondary";
    default: return "secondary";
  }
}

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
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<PersonForm>(emptyPersonForm);
  const [creating, setCreating] = useState(false);
  const [changingRoleUserId, setChangingRoleUserId] = useState<string | null>(null);
  const [changingRoleValue, setChangingRoleValue] = useState<string>("");
  const [page, setPage] = useState(1);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [deleteUserName, setDeleteUserName] = useState("");

  const PAGE_SIZE = 20;

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[admin/users] Failed to load users:", error.message);
    }
    setUsers((data || []) as Profile[]);
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
      setChangingRoleValue("");
      loadUsers();
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
    loadUsers();
  }

  async function handleDeleteUser() {
    if (!deleteUserId) return;

    const { error } = await supabase.rpc("admin_delete_user", {
      p_user_id: deleteUserId,
    });

    if (error) {
      showToast(t("common.error"), "error");
    } else {
      showToast(t("admin.userDeleted"), "success");
      logAction("delete_user", "user", deleteUserId, { name: deleteUserName });
      loadUsers();
    }
    setDeleteUserId(null);
    setDeleteUserName("");
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
    return (
      <div className="animate-fade-in">
        <PageBreadcrumbs items={[{ label: t("admin.dashboard"), href: "/admin" }, { label: t("admin.users") }]} />
        <div className="flex items-center justify-between mb-6 mt-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="flex gap-3 mb-4">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-9 w-40" />
        </div>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><Skeleton className="h-4 w-20" /></TableHead>
                <TableHead><Skeleton className="h-4 w-20" /></TableHead>
                <TableHead><Skeleton className="h-4 w-12" /></TableHead>
                <TableHead><Skeleton className="h-4 w-16" /></TableHead>
                <TableHead><Skeleton className="h-4 w-16" /></TableHead>
                <TableHead><Skeleton className="h-4 w-24" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-14" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-6" /></TableCell>
                  <TableCell><div className="flex gap-1"><Skeleton className="h-7 w-16" /><Skeleton className="h-7 w-16" /><Skeleton className="h-7 w-16" /></div></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageBreadcrumbs items={[{ label: t("admin.dashboard"), href: "/admin" }, { label: t("admin.users") }]} />

      <div className="flex items-center justify-between mb-6 mt-4">
        <h1 className="text-2xl font-bold">{t("admin.userManagement")}</h1>
        <Button onClick={() => setShowForm(true)}>
          <Plus /> {t("admin.addPerson")}
        </Button>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("admin.addPerson")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            <div>
              <Label className="mb-1.5">{t("auth.phone")}</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="01XXXXXXXXX"
                dir="ltr"
              />
            </div>
            <div>
              <Label className="mb-1.5">{t("auth.fullName")}</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>
            <div>
              <Label className="mb-1.5">{t("auth.gender")}</Label>
              <Select
                value={form.gender}
                onValueChange={(val: string | null) => setForm({ ...form, gender: (val ?? "Male") as "Male" | "Female" })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">{t("auth.male")}</SelectItem>
                  <SelectItem value="Female">{t("auth.female")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5">{t("admin.role")}</Label>
              <Select
                value={form.role}
                onValueChange={(val: string | null) => {
                  const newRole = (val ?? "patient") as UserRole;
                  setForm({ ...form, role: newRole, has_wheelchair: newRole === "patient" ? form.has_wheelchair : false });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CREATABLE_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{getRoleLabel(r, t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5">{t("auth.password")}</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                dir="ltr"
                placeholder="••••••••"
              />
            </div>
            {form.role === "patient" && (
              <div className="flex items-center gap-3 sm:col-span-2">
                <Switch
                  checked={form.has_wheelchair}
                  onCheckedChange={(checked: boolean) => setForm({ ...form, has_wheelchair: checked })}
                />
                <Label>♿ {t("admin.wheelchair")}</Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleCreatePerson} disabled={creating}>
              {creating ? t("common.loading") : t("admin.addPerson")}
            </Button>
            <Button variant="outline" onClick={() => { setShowForm(false); setForm(emptyPersonForm); }}>
              {t("admin.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!resetUserId}
        onOpenChange={(open) => { if (!open) { setResetUserId(null); setNewPassword(""); } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.resetPassword")}</DialogTitle>
          </DialogHeader>
          <div>
            <Label className="mb-1.5">{t("admin.newPassword")}</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              dir="ltr"
              placeholder="••••••••"
            />
          </div>
          <DialogFooter>
            <Button onClick={handleResetPassword} disabled={saving}>
              {saving ? t("common.loading") : t("admin.resetPassword")}
            </Button>
            <Button variant="outline" onClick={() => { setResetUserId(null); setNewPassword(""); }}>
              {t("admin.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!changingRoleUserId}
        onOpenChange={(open) => { if (!open) { setChangingRoleUserId(null); setChangingRoleValue(""); } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.changeRole")}</DialogTitle>
          </DialogHeader>
          <div>
            <Label className="mb-1.5">{t("admin.role")}</Label>
            <Select
              value={changingRoleValue}
              onValueChange={(val: string | null) => setChangingRoleValue(val ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_ROLES.filter((r) => r !== "super_admin").map((r) => (
                  <SelectItem key={r} value={r}>{getRoleLabel(r, t)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                if (changingRoleUserId && changingRoleValue) {
                  handleChangeRole(changingRoleUserId, changingRoleValue);
                }
              }}
              disabled={!changingRoleValue}
            >
              {t("admin.save")}
            </Button>
            <Button variant="outline" onClick={() => { setChangingRoleUserId(null); setChangingRoleValue(""); }}>
              {t("admin.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteUserId}
        onOpenChange={(open) => { if (!open) { setDeleteUserId(null); setDeleteUserName(""); } }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.confirmDeleteUser")}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteUserName}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDeleteUser}
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            className="ps-9"
            placeholder={t("admin.searchUsers")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={roleFilter || undefined}
          onValueChange={(val: string | null) => setRoleFilter(val || "")}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder={t("admin.all")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t("admin.all")}</SelectItem>
            {ALL_ROLES.map((r) => (
              <SelectItem key={r} value={r}>{getRoleLabel(r, t)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("auth.fullName")}</TableHead>
              <TableHead>{t("auth.phone")}</TableHead>
              <TableHead>{t("admin.role")}</TableHead>
              <TableHead>{t("auth.gender")}</TableHead>
              <TableHead>♿</TableHead>
              <TableHead>{t("admin.actions") || ""}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.full_name}</TableCell>
                <TableCell dir="ltr" className="text-muted-foreground">{u.phone}</TableCell>
                <TableCell>
                  <Badge variant={getRoleBadgeVariant(u.role)}>
                    {getRoleLabel(u.role, t)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={u.gender === "Male" ? "secondary" : "outline"}>
                    {u.gender === "Male" ? t("auth.male") : t("auth.female")}
                  </Badge>
                </TableCell>
                <TableCell>
                  {u.has_wheelchair && (
                    <Badge variant="outline">♿</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {u.role === "super_admin" ? (
                      <Badge variant="secondary">
                        <Shield className="size-3" />
                        {t("admin.protectedAccount")}
                      </Badge>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setChangingRoleUserId(u.id);
                            setChangingRoleValue(u.role);
                          }}
                        >
                          <Pencil /> {t("admin.changeRole")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setResetUserId(u.id)}
                        >
                          <KeyRound /> {t("admin.resetPassword")}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setDeleteUserId(u.id);
                            setDeleteUserName(u.full_name);
                          }}
                        >
                          <Trash2 /> {t("common.delete")}
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filtered.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {t("admin.noUsers")}
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 py-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              ←
            </Button>
            <span className="text-sm text-muted-foreground px-2">{page} / {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              →
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
