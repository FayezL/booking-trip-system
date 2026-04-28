"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useToast } from "@/components/Toast";
import LoadingSpinner from "@/components/LoadingSpinner";
import { logAction } from "@/lib/admin-logs";
import type { Profile, Bus, Sector, FamilyMember } from "@/lib/types/database";
import Toggle from "@/components/Toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Users, Search, Plus, Filter, ChevronLeft, ChevronRight } from "lucide-react";

type RegisterForm = {
  phone: string;
  full_name: string;
  gender: "Male" | "Female";
  password: string;
  bus_id: string;
  role: string;
  has_wheelchair: boolean;
  sector_id: string;
};

const emptyForm: RegisterForm = {
  phone: "",
  full_name: "",
  gender: "Male",
  password: "",
  bus_id: "",
  role: "patient",
  has_wheelchair: false,
  sector_id: "",
};

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export default function UnbookedTab({ tripId }: { tripId: string }) {
  const { t, lang } = useTranslation();
  const supabase = createClient();
  const { showToast } = useToast();

  const [unbooked, setUnbooked] = useState<Profile[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [genderFilter, setGenderFilter] = useState<"" | "Male" | "Female">("");
  const [sectorFilter, setSectorFilter] = useState("");
  const [showRegister, setShowRegister] = useState(false);
  const [form, setForm] = useState<RegisterForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [bookingUser, setBookingUser] = useState<string | null>(null);
  const [selectedBus, setSelectedBus] = useState<string>("");
  const [selectedFamilyIds, setSelectedFamilyIds] = useState<string[]>([]);
  const [bookingFamily, setBookingFamily] = useState<FamilyMember[]>([]);
  const [page, setPage] = useState(1);

  const PAGE_SIZE = 20;

  const loadData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [allBookedRes, busListRes, sectorsRes] = await Promise.all([
        supabase.from("bookings").select("user_id").eq("trip_id", tripId).is("cancelled_at", null).is("family_member_id", null),
        supabase.from("buses").select("*").eq("trip_id", tripId),
        supabase.rpc("get_sectors"),
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
      setSectors((sectorsRes.data || []) as Sector[]);
    } catch {
      showToast(t("common.error"), "error");
    } finally {
      setLoading(false);
    }
  }, [tripId, supabase, showToast, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function startBookForUser(userId: string) {
    setBookingUser(userId);
    setSelectedBus(buses.length > 0 ? buses[0].id : "");
    setSelectedFamilyIds([]);
    supabase.rpc("get_family_members", { p_user_id: userId }).then(({ data }: { data: unknown }) => {
      setBookingFamily((data || []) as FamilyMember[]);
    });
  }

  async function confirmBookForUser() {
    if (!bookingUser || !selectedBus) {
      showToast(t("common.error"), "error");
      return;
    }

    const { error } = await supabase.rpc("book_bus_with_family", {
      p_user_id: bookingUser,
      p_trip_id: tripId,
      p_bus_id: selectedBus,
      p_family_member_ids: selectedFamilyIds,
    });

    if (error) {
      showToast(t("common.error"), "error");
    } else {
      showToast(t("admin.book"), "success");
      logAction("book_user", "booking", undefined, { user_id: bookingUser, family_count: selectedFamilyIds.length });
      setBookingUser(null);
      setBookingFamily([]);
      setSelectedFamilyIds([]);
      loadData();
    }
  }

  async function handleRegister() {
    if (!form.phone || !/^\d{8,15}$/.test(form.phone) || !form.full_name || !form.password || form.password.length < 6) {
      showToast(t("common.error"), "error");
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
      p_sector_id: form.sector_id || null,
    });

    setSaving(false);

    if (error) {
      if (error.message.includes("already registered") || error.message.includes("unique")) {
        showToast(t("auth.phoneExists"), "error");
        setShowRegister(false);
        setForm(emptyForm);
        loadData();
      } else {
        showToast(t("common.error"), "error");
      }
      return;
    }

    showToast(t("admin.registerPatient"), "success");
    logAction("register_patient", "user", undefined, { phone: form.phone });
    setShowRegister(false);
    setForm(emptyForm);
    loadData();
  }

  const filtered = useMemo(() => unbooked.filter((p) => {
    const matchesSearch = !search || p.full_name.includes(search);
    const matchesGender = !genderFilter || p.gender === genderFilter;
    const matchesSector = !sectorFilter || p.sector_id === sectorFilter;
    return matchesSearch && matchesGender && matchesSector;
  }), [unbooked, search, genderFilter, sectorFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search, genderFilter, sectorFilter]);

  const { maleCount, femaleCount } = useMemo(() => ({
    maleCount: unbooked.filter((p) => p.gender === "Male").length,
    femaleCount: unbooked.filter((p) => p.gender === "Female").length,
  }), [unbooked]);

  if (loading) {
    return <LoadingSpinner text={t("common.loading")} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <div>
            <h2 className="text-lg font-semibold">{t("admin.unbooked")}</h2>
            <p className="text-sm text-muted-foreground">
              {unbooked.length} {t("admin.unbooked")}
              <Badge variant="outline" className="mx-1 text-[10px]">♂ {maleCount}</Badge>
              <Badge variant="outline" className="text-[10px]">♀ {femaleCount}</Badge>
            </p>
          </div>
        </div>
        <Button onClick={() => setShowRegister(!showRegister)} className="gap-2 w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          {t("admin.registerPatient")}
        </Button>
      </div>

      <Dialog open={showRegister} onOpenChange={setShowRegister}>
        <DialogContent className="sm:max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>{t("admin.registerPatient")}</DialogTitle>
            <DialogDescription>{t("auth.phone")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1.5 block">{t("auth.phone")}</label>
              <input
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="01XXXXXXXXX"
                dir="ltr"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1.5 block">{t("auth.fullName")}</label>
              <input
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1.5 block">{t("auth.gender")}</label>
              <select
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
              <label className="text-sm font-medium text-muted-foreground mb-1.5 block">{t("admin.role")}</label>
              <select
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                <Toggle
                  checked={form.has_wheelchair}
                  onChange={(v) => setForm({ ...form, has_wheelchair: v })}
                />
                <span className="text-sm text-muted-foreground">♿ {t("admin.wheelchair")}</span>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1.5 block">{t("sectors.select")}</label>
              <Select value={form.sector_id} onValueChange={(v) => setForm({ ...form, sector_id: v })}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder={t("sectors.none")} />
                </SelectTrigger>
                <SelectContent>
                  {sectors.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.code} - {s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1.5 block">{t("auth.password")}</label>
              <input
                type="password"
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                dir="ltr"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-muted-foreground mb-1.5 block">{t("buses.chooseBus")} ({t("admin.cancel")})</label>
              <Select value={form.bus_id} onValueChange={(v) => setForm({ ...form, bus_id: v })}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="---" />
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
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button onClick={handleRegister} disabled={saving}>
              {saving ? t("common.loading") : t("admin.registerPatient")}
            </Button>
            <Button variant="outline" onClick={() => setShowRegister(false)}>
              {t("admin.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!bookingUser} onOpenChange={(open) => { if (!open) { setBookingUser(null); setBookingFamily([]); setSelectedFamilyIds([]); } }}>
        <DialogContent className="sm:max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>{t("admin.book")}</DialogTitle>
            <DialogDescription>{t("buses.chooseBus")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={selectedBus} onValueChange={setSelectedBus}>
              <SelectTrigger className="h-10">
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
            {bookingFamily.length > 0 && (
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">{t("family.selectMembers")}</label>
                <div className="flex flex-wrap gap-2">
                  {bookingFamily.map((fm) => (
                    <button
                      key={fm.id}
                      type="button"
                      onClick={() => setSelectedFamilyIds((prev) =>
                        prev.includes(fm.id) ? prev.filter((id) => id !== fm.id) : [...prev, fm.id]
                      )}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all duration-150 active:scale-95",
                        selectedFamilyIds.includes(fm.id)
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-muted bg-background text-muted-foreground hover:border-muted-foreground/30"
                      )}
                    >
                      {fm.full_name} {fm.gender === "Male" ? "♂" : "♀"}{fm.has_wheelchair ? " ♿" : ""}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button onClick={confirmBookForUser}>
              {t("admin.book")}{selectedFamilyIds.length > 0 ? ` (${1 + selectedFamilyIds.length})` : ""}
            </Button>
            <Button variant="outline" onClick={() => { setBookingUser(null); setBookingFamily([]); setSelectedFamilyIds([]); }}>
              {t("admin.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 min-w-[140px] max-w-xs">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            className="flex h-9 w-full rounded-lg border border-input bg-background pr-9 pl-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder={t("admin.searchByName")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <div className="flex gap-1 bg-muted p-1 rounded-lg">
          {(["", "Male", "Female"] as const).map((g) => (
            <Button
              key={g}
              size="sm"
              variant={genderFilter === g ? "secondary" : "ghost"}
              className="h-8 text-xs"
              onClick={() => setGenderFilter(g)}
            >
              {g === "" ? t("admin.all") : g === "Male" ? t("auth.male") : t("auth.female")}
            </Button>
          ))}
        </div>
        <Select value={sectorFilter} onValueChange={setSectorFilter}>
          <SelectTrigger className="h-9 w-auto min-w-[140px]">
            <Filter className="h-3.5 w-3.5 ml-2 text-muted-foreground" />
            <SelectValue placeholder={t("sectors.all")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("sectors.all")}</SelectItem>
            {sectors.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.code} - {s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">{t("admin.noBookings")}</p>
          </div>
        ) : (
          <>
            {paginated.map((p) => (
              <Card key={p.id} className="transition-all hover:shadow-sm">
                <CardContent className="p-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className={cn("text-xs", p.gender === "Male" ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300" : "bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300")}>
                          {getInitials(p.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium text-sm">{p.full_name}</span>
                        <span className="text-xs text-muted-foreground" dir="ltr">{p.phone}</span>
                        {p.has_wheelchair && (
                          <Badge variant="outline" className="text-[10px] px-1.5 border-amber-300 text-amber-600 dark:text-amber-400">♿</Badge>
                        )}
                        {p.sector_id && (
                          <Badge variant="outline" className="text-[10px] px-1.5 border-teal-300 text-teal-600 dark:text-teal-400">
                            {sectors.find((s) => s.id === p.sector_id)?.name || ""}
                          </Badge>
                        )}
                        <Badge variant="outline" className={cn("text-[10px]", p.gender === "Male" ? "border-blue-300 text-blue-600 dark:text-blue-400" : "border-pink-300 text-pink-600 dark:text-pink-400")}>
                          {p.gender === "Male" ? t("auth.male") : t("auth.female")}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={() => startBookForUser(p.id)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {t("admin.book")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground min-w-[60px] text-center">{page} / {totalPages}</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
