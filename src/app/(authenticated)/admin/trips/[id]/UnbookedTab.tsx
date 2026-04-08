"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { toast } from "sonner";
import { logAction } from "@/lib/admin-logs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Plus, User, BookOpen } from "lucide-react";
import type { Profile, Bus } from "@/lib/types/database";

type RegisterForm = {
  phone: string;
  full_name: string;
  gender: "Male" | "Female";
  password: string;
  bus_id: string;
  role: string;
  has_wheelchair: boolean;
};

const emptyForm: RegisterForm = {
  phone: "",
  full_name: "",
  gender: "Male",
  password: "",
  bus_id: "",
  role: "patient",
  has_wheelchair: false,
};

export default function UnbookedTab({ tripId }: { tripId: string }) {
  const { t, lang } = useTranslation();
  const supabase = createClient();

  const [unbooked, setUnbooked] = useState<Profile[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [genderFilter, setGenderFilter] = useState<"" | "Male" | "Female">("");
  const [showRegister, setShowRegister] = useState(false);
  const [form, setForm] = useState<RegisterForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [bookingUser, setBookingUser] = useState<string | null>(null);
  const [selectedBus, setSelectedBus] = useState<string>("");
  const [page, setPage] = useState(1);

  const PAGE_SIZE = 20;

  useEffect(() => {
    loadData();
  }, [tripId]);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [allBookedRes, busListRes] = await Promise.all([
      supabase.from("bookings").select("user_id").eq("trip_id", tripId).is("cancelled_at", null),
      supabase.from("buses").select("*").eq("trip_id", tripId),
    ]);

    const bookedIds = (allBookedRes.data || []).map((b: { user_id: string }) => b.user_id);

    let profilesQuery = supabase
      .from("profiles")
      .select("*")
      .neq("id", user.id)
      .is("deleted_at", null);

    if (bookedIds.length > 0) {
      profilesQuery = profilesQuery.not("id", "in", `(${bookedIds.join(",")})`);
    }

    const profilesRes = await profilesQuery.order("full_name");

    setUnbooked((profilesRes.data || []) as Profile[]);
    setBuses(busListRes.data || []);
    setLoading(false);
  }

  function startBookForUser(userId: string) {
    setBookingUser(userId);
    setSelectedBus(buses.length > 0 ? buses[0].id : "");
  }

  async function confirmBookForUser() {
    if (!bookingUser || !selectedBus) {
      toast.error(t("common.error"));
      return;
    }

    const { error } = await supabase.rpc("book_bus", {
      p_user_id: bookingUser,
      p_trip_id: tripId,
      p_bus_id: selectedBus,
    });

    if (error) {
      toast.error(t("common.error"));
    } else {
      toast.success(t("admin.book"));
      logAction("book_user", "booking", undefined, { user_id: bookingUser });
      setBookingUser(null);
      loadData();
    }
  }

  async function handleRegister() {
    if (!form.phone || !/^\d{8,15}$/.test(form.phone) || !form.full_name || !form.password || form.password.length < 6) {
      toast.error(t("common.error"));
      return;
    }

    setSaving(true);

    const { error } = await supabase.rpc("register_and_book", {
      p_phone: form.phone,
      p_full_name: form.full_name,
      p_gender: form.gender,
      p_password: form.password,
      p_trip_id: form.bus_id ? tripId : null,
      p_bus_id: form.bus_id || null,
      p_role: form.role,
      p_has_wheelchair: form.has_wheelchair,
    });

    setSaving(false);

    if (error) {
      if (error.message.includes("already registered") || error.message.includes("unique")) {
        toast.error(t("auth.phoneExists"));
        setShowRegister(false);
        setForm(emptyForm);
        loadData();
      } else {
        toast.error(t("common.error"));
      }
      return;
    }

    toast.success(t("admin.registerPatient"));
    logAction("register_patient", "user", undefined, { phone: form.phone });
    setShowRegister(false);
    setForm(emptyForm);
    loadData();
  }

  const filtered = useMemo(() => unbooked.filter((p) => {
    const matchesSearch = !search || p.full_name.includes(search);
    const matchesGender = !genderFilter || p.gender === genderFilter;
    return matchesSearch && matchesGender;
  }), [unbooked, search, genderFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search, genderFilter]);

  const { maleCount, femaleCount } = useMemo(() => ({
    maleCount: unbooked.filter((p) => p.gender === "Male").length,
    femaleCount: unbooked.filter((p) => p.gender === "Female").length,
  }), [unbooked]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 animate-fade-in">
        <div className="w-12 h-12 rounded-full border-4 border-slate-100 dark:border-gray-700 border-t-blue-600 dark:border-t-blue-400 animate-spin" />
        <p className="text-lg text-slate-400 dark:text-gray-400">{t("common.loading")}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold">{t("admin.unbooked")}</h2>
          <p className="text-sm text-muted-foreground">
            {unbooked.length} {t("admin.unbooked")} ({maleCount}M, {femaleCount}F)
          </p>
        </div>
        <Button onClick={() => setShowRegister(true)} className="w-full sm:w-auto">
          <Plus /> {t("admin.registerPatient")}
        </Button>
      </div>

      <Dialog open={showRegister} onOpenChange={setShowRegister}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("admin.registerPatient")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
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
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                value={form.gender}
                onChange={(e) =>
                  setForm({ ...form, gender: e.target.value as "Male" | "Female" })
                }
              >
                <option value="Male">{t("auth.male")}</option>
                <option value="Female">{t("auth.female")}</option>
              </select>
            </div>
            <div>
              <Label className="mb-1.5">{t("admin.role")}</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                value={form.role}
                onChange={(e) => {
                  const newRole = e.target.value;
                  setForm({ ...form, role: newRole, has_wheelchair: newRole === "patient" ? form.has_wheelchair : false });
                }}
              >
                <option value="patient">{t("admin.patient")}</option>
                <option value="companion">{t("admin.companion")}</option>
                <option value="family_assistant">{t("admin.familyAssistant")}</option>
              </select>
            </div>
            {form.role === "patient" && (
              <div className="flex items-center gap-3">
                <Switch
                  checked={form.has_wheelchair}
                  onCheckedChange={(checked: boolean) => setForm({ ...form, has_wheelchair: checked })}
                />
                <span className="text-sm text-muted-foreground">♿ {t("admin.wheelchair")}</span>
              </div>
            )}
            <div>
              <Label className="mb-1.5">{t("auth.password")}</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                dir="ltr"
              />
            </div>
            <div className="md:col-span-2">
              <Label className="mb-1.5">{t("buses.chooseBus")} ({t("admin.cancel")})</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                value={form.bus_id}
                onChange={(e) => setForm({ ...form, bus_id: e.target.value })}
              >
                <option value="">---</option>
                {buses.map((bus) => (
                  <option key={bus.id} value={bus.id}>
                    {bus.bus_label || (lang === "ar" ? bus.area_name_ar : bus.area_name_en)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleRegister} disabled={saving}>
              {saving ? t("common.loading") : t("admin.registerPatient")}
            </Button>
            <Button variant="outline" onClick={() => setShowRegister(false)}>
              {t("admin.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!bookingUser} onOpenChange={(open) => { if (!open) setBookingUser(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.book")}</DialogTitle>
          </DialogHeader>
          <div>
            <Label className="mb-1.5">{t("buses.chooseBus")}</Label>
            <Select value={selectedBus} onValueChange={(v) => setSelectedBus(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {buses.map((bus) => (
                  <SelectItem key={bus.id} value={bus.id}>
                    {bus.bus_label || (lang === "ar" ? bus.area_name_ar : bus.area_name_en)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button onClick={confirmBookForUser}>
              <BookOpen /> {t("admin.book")}
            </Button>
            <Button variant="outline" onClick={() => setBookingUser(null)}>
              {t("admin.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 min-w-[140px] max-w-xs">
          <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder={t("admin.searchByName")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="ps-8"
          />
        </div>
        <div className="flex gap-1">
          {(["", "Male", "Female"] as const).map((g) => (
            <Button
              key={g}
              variant={genderFilter === g ? "default" : "outline"}
              size="sm"
              onClick={() => setGenderFilter(g)}
            >
              {g === "" ? t("admin.all") : g === "Male" ? t("auth.male") : t("auth.female")}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-muted-foreground text-center py-4 text-sm">{t("admin.noBookings")}</p>
        ) : (
          <>
            {paginated.map((p) => (
              <Card key={p.id}>
                <CardContent>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <User className="size-4 text-muted-foreground" />
                      <span className="font-medium text-sm">{p.full_name}</span>
                      <span className="text-xs text-muted-foreground" dir="ltr">{p.phone}</span>
                      {p.has_wheelchair && (
                        <Badge variant="secondary" className="text-xs" title={t("admin.wheelchair")}>♿</Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {p.gender === "Male" ? t("auth.male") : t("auth.female")}
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => startBookForUser(p.id)}
                      className="w-full sm:w-auto"
                    >
                      <BookOpen /> {t("admin.book")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  ←
                </Button>
                <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
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
          </>
        )}
      </div>
    </div>
  );
}
