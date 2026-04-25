"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useToast } from "@/components/Toast";
import { PASSWORD_MIN_LENGTH, PHONE_REGEX } from "@/lib/constants";
import type { Sector, Profile, FamilyMember } from "@/lib/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { User, Phone, Lock, Bus, Car, Users, Plus, Edit, Trash2, MapPin } from "lucide-react";

type FamilyForm = {
  full_name: string;
  gender: "Male" | "Female";
  has_wheelchair: boolean;
};

const emptyFamilyForm: FamilyForm = {
  full_name: "",
  gender: "Male",
  has_wheelchair: false,
};

function getInitials(name: string): string {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const supabase = createClient();
  const { showToast } = useToast();

  const [sectors, setSectors] = useState<Sector[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentSectorId, setCurrentSectorId] = useState<string | null>(null);
  const [selectedSector, setSelectedSector] = useState<string>("");
  const [hasCar, setHasCar] = useState(false);
  const [carSeats, setCarSeats] = useState(4);
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [transportType, setTransportType] = useState<"private" | "bus">("bus");
  const [servantsNeeded, setServantsNeeded] = useState<0 | 1 | 2>(0);
  const [savingTransport, setSavingTransport] = useState(false);
  const [savingSector, setSavingSector] = useState(false);
  const [savingCar, setSavingCar] = useState(false);

  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [showFamilyForm, setShowFamilyForm] = useState(false);
  const [editingFamilyId, setEditingFamilyId] = useState<string | null>(null);
  const [familyForm, setFamilyForm] = useState<FamilyForm>(emptyFamilyForm);
  const [savingFamily, setSavingFamily] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [sectorsRes, { data: { user } }] = await Promise.all([
        supabase.rpc("get_sectors"),
        supabase.auth.getUser(),
      ]);
      if (!user) return;

      setSectors((sectorsRes.data || []) as Sector[]);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileData) {
        const p = profileData as Profile;
        setProfile(p);
        setCurrentSectorId(p.sector_id);
        setSelectedSector(p.sector_id || "");
        setHasCar(p.has_car);
        setCarSeats(p.car_seats || 4);
        setNewName(p.full_name);
        setNewPhone(p.phone);
        setTransportType(p.transport_type || "bus");
        setServantsNeeded(p.servants_needed ?? 0);
      }

      const { data: fmData } = await supabase.rpc("get_family_members");
      setFamilyMembers((fmData || []) as FamilyMember[]);
    } catch {
      showToast(t("common.error"), "error");
    } finally {
      setLoading(false);
    }
  }, [supabase, showToast, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const currentSectorName = useMemo(() => {
    if (!currentSectorId) return "";
    return sectors.find((s) => s.id === currentSectorId)?.name || "";
  }, [currentSectorId, sectors]);

  const isServant = profile?.role === "servant";

  async function handleSaveName() {
    if (!newName.trim()) return;
    setSavingName(true);
    const { error } = await supabase.rpc("update_own_name", { p_name: newName.trim() });
    setSavingName(false);
    if (error) {
      showToast(t("common.error"), "error");
    } else {
      showToast(t("settings.nameUpdated"), "success");
    }
  }

  async function handleSavePhone() {
    const digits = newPhone.replace(/\D/g, "");
    if (!PHONE_REGEX.test(digits)) {
      showToast(t("auth.phoneRequired"), "error");
      return;
    }
    setSavingPhone(true);
    const { error } = await supabase.rpc("update_own_phone", { p_phone: digits });
    setSavingPhone(false);
    if (error) {
      if (error.message.includes("already")) {
        showToast(t("auth.phoneExists"), "error");
      } else {
        showToast(t("common.error"), "error");
      }
    } else {
      showToast(t("settings.phoneUpdated"), "success");
    }
  }

  async function handleSavePassword() {
    if (!currentPassword || !newPassword || newPassword.length < PASSWORD_MIN_LENGTH) {
      showToast(t("auth.passwordRequired"), "error");
      return;
    }

    setSavingPassword(true);

    const phone = profile?.phone || "";
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: `${phone}@church.local`,
      password: currentPassword,
    });

    if (verifyError) {
      setSavingPassword(false);
      showToast(t("settings.wrongPassword"), "error");
      return;
    }

    const { error } = await supabase.rpc("update_own_password", { p_new_password: newPassword });
    setSavingPassword(false);

    if (error) {
      showToast(t("common.error"), "error");
    } else {
      setCurrentPassword("");
      setNewPassword("");
      showToast(t("settings.passwordUpdated"), "success");
    }
  }

  async function handleSaveTransport() {
    setSavingTransport(true);
    const { error } = await supabase.rpc("update_own_transport", {
      p_transport_type: transportType,
      p_servants_needed: servantsNeeded,
    });
    setSavingTransport(false);
    if (error) {
      showToast(t("common.error"), "error");
    } else {
      showToast(t("settings.transportUpdated"), "success");
    }
  }

  async function handleSaveSector() {
    if (selectedSector === (currentSectorId || "")) return;
    setSavingSector(true);
    const { error } = await supabase.rpc("update_own_sector", {
      p_sector_id: selectedSector || null,
    });
    setSavingSector(false);
    if (error) {
      showToast(t("common.error"), "error");
    } else {
      setCurrentSectorId(selectedSector || null);
      showToast(t("settings.saved"), "success");
    }
  }

  async function handleSaveCar() {
    setSavingCar(true);
    const { error } = await supabase.rpc("update_own_car_settings", {
      p_has_car: hasCar,
      p_car_seats: hasCar ? carSeats : null,
    });
    setSavingCar(false);
    if (error) {
      showToast(t("common.error"), "error");
    } else {
      showToast(t("settings.saved"), "success");
    }
  }

  function startAddFamily() {
    setEditingFamilyId(null);
    setFamilyForm(emptyFamilyForm);
    setShowFamilyForm(true);
  }

  function startEditFamily(member: FamilyMember) {
    setEditingFamilyId(member.id);
    setFamilyForm({
      full_name: member.full_name,
      gender: member.gender,
      has_wheelchair: member.has_wheelchair,
    });
    setShowFamilyForm(true);
  }

  async function handleSaveFamily() {
    if (!familyForm.full_name.trim()) {
      showToast(t("auth.nameRequired"), "error");
      return;
    }

    setSavingFamily(true);

    if (editingFamilyId) {
      const { error } = await supabase.rpc("update_family_member", {
        p_member_id: editingFamilyId,
        p_full_name: familyForm.full_name.trim(),
        p_gender: familyForm.gender,
        p_has_wheelchair: familyForm.has_wheelchair,
      });
      setSavingFamily(false);
      if (error) {
        showToast(t("common.error"), "error");
      } else {
        showToast(t("family.memberUpdated"), "success");
        setShowFamilyForm(false);
        loadData();
      }
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.rpc("add_family_member", {
        p_head_user_id: user.id,
        p_full_name: familyForm.full_name.trim(),
        p_gender: familyForm.gender,
        p_has_wheelchair: familyForm.has_wheelchair,
      });
      setSavingFamily(false);
      if (error) {
        showToast(t("common.error"), "error");
      } else {
        showToast(t("family.memberAdded"), "success");
        setShowFamilyForm(false);
        loadData();
      }
    }
  }

  async function handleRemoveFamily(memberId: string) {
    if (!confirm(t("family.confirmRemove"))) return;
    const { error } = await supabase.rpc("remove_family_member", { p_member_id: memberId });
    if (error) {
      showToast(t("common.error"), "error");
    } else {
      showToast(t("family.memberRemoved"), "success");
      loadData();
    }
  }

  if (loading) {
    return (
      <div className="animate-fade-in">
        <h1 className="section-title mb-6">{t("settings.title")}</h1>
        <Card>
          <CardContent className="py-8">
            <p className="text-muted-foreground text-center">{t("common.loading")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-4">
      <h1 className="section-title mb-6">{t("settings.title")}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-5 w-5" />
            {t("settings.accountGroup")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              {t("settings.changeName")}
            </Label>
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                type="text"
                className="flex-1"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                disabled={savingName}
              />
              <Button
                onClick={handleSaveName}
                disabled={savingName || !newName.trim() || newName.trim() === profile?.full_name}
                className="shrink-0"
              >
                {savingName ? t("common.loading") : t("common.save")}
              </Button>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" />
              {t("settings.changePhone")}
            </Label>
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                className="flex-1 font-mono tracking-widest"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, "").slice(0, 15))}
                dir="ltr"
                disabled={savingPhone}
              />
              <Button
                onClick={handleSavePhone}
                disabled={savingPhone || !PHONE_REGEX.test(newPhone.replace(/\D/g, "")) || newPhone === profile?.phone}
                className="shrink-0"
              >
                {savingPhone ? t("common.loading") : t("common.save")}
              </Button>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" />
              {t("settings.changePassword")}
            </Label>
            <div className="space-y-3">
              <Input
                type="password"
                placeholder={t("settings.currentPassword")}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                dir="ltr"
                disabled={savingPassword}
              />
              <Input
                type="password"
                placeholder={t("settings.newPasswordLabel")}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                dir="ltr"
                disabled={savingPassword}
              />
              <Button
                onClick={handleSavePassword}
                disabled={savingPassword || !currentPassword || newPassword.length < PASSWORD_MIN_LENGTH}
              >
                {savingPassword ? t("common.loading") : t("common.save")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bus className="h-5 w-5" />
            {t("settings.tripDetailsGroup")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>{t("settings.transportType")}</Label>
            <div className="flex gap-3">
              <Button
                type="button"
                variant={transportType === "private" ? "default" : "outline"}
                onClick={() => setTransportType("private")}
                className="flex-1 min-h-[48px] text-base"
              >
                {t("settings.transportPrivate")}
              </Button>
              <Button
                type="button"
                variant={transportType === "bus" ? "default" : "outline"}
                onClick={() => setTransportType("bus")}
                className="flex-1 min-h-[48px] text-base"
              >
                {t("settings.transportBus")}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("settings.servantsNeeded")}</Label>
            <div className="flex gap-3">
              {([0, 1, 2] as const).map((n) => (
                <Button
                  key={n}
                  type="button"
                  variant={servantsNeeded === n ? "default" : "outline"}
                  onClick={() => setServantsNeeded(n)}
                  className="flex-1 min-h-[48px] text-base"
                >
                  {n}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {t("settings.sector")}
            </Label>
            {currentSectorName && (
              <p className="text-sm text-muted-foreground">
                {t("sectors.yourSector")}: <span className="font-medium text-teal-600 dark:text-teal-400">{currentSectorName}</span>
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 flex-1"
                value={selectedSector}
                onChange={(e) => setSelectedSector(e.target.value)}
              >
                <option value="">{t("sectors.select")}</option>
                {sectors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} - {s.name}
                  </option>
                ))}
              </select>
              <Button
                onClick={handleSaveSector}
                disabled={savingSector || selectedSector === (currentSectorId || "")}
                className="shrink-0"
              >
                {savingSector ? t("common.loading") : t("common.save")}
              </Button>
            </div>
          </div>

          <Button
            onClick={handleSaveTransport}
            disabled={savingTransport}
          >
            {savingTransport ? t("common.loading") : t("common.save")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5" />
              {t("family.title")}
            </CardTitle>
            <Button size="sm" onClick={startAddFamily} className="gap-1">
              <Plus className="h-4 w-4" />
              {t("family.add")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Dialog open={showFamilyForm} onOpenChange={(open) => {
            setShowFamilyForm(open);
            if (!open) setEditingFamilyId(null);
          }}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {editingFamilyId ? <Edit className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                  {editingFamilyId ? t("common.edit") : t("family.add")}
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>{t("family.name")}</Label>
                  <Input
                    value={familyForm.full_name}
                    onChange={(e) => setFamilyForm({ ...familyForm, full_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("family.gender")}</Label>
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant={familyForm.gender === "Male" ? "default" : "outline"}
                      onClick={() => setFamilyForm({ ...familyForm, gender: "Male" })}
                      className="flex-1 min-h-[48px]"
                    >
                      {t("family.male")}
                    </Button>
                    <Button
                      type="button"
                      variant={familyForm.gender === "Female" ? "default" : "outline"}
                      onClick={() => setFamilyForm({ ...familyForm, gender: "Female" })}
                      className={cn(
                        "flex-1 min-h-[48px]",
                        familyForm.gender === "Female" && "bg-pink-600 hover:bg-pink-700 text-white"
                      )}
                    >
                      {t("family.female")}
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={familyForm.has_wheelchair}
                    onCheckedChange={(checked) => setFamilyForm({ ...familyForm, has_wheelchair: checked })}
                  />
                  <Label>{t("family.wheelchair")}</Label>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button onClick={handleSaveFamily} disabled={savingFamily || !familyForm.full_name.trim()}>
                  {savingFamily ? t("common.loading") : t("common.save")}
                </Button>
                <Button variant="outline" onClick={() => setShowFamilyForm(false)}>
                  {t("admin.cancel")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {familyMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{t("family.noMembers")}</p>
          ) : (
            <div className="space-y-2">
              {familyMembers.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs font-semibold bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400">
                        {getInitials(member.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium text-foreground">{member.full_name}</span>
                    <Badge variant="outline" className={cn(
                      "text-xs",
                      member.gender === "Male"
                        ? "border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400"
                        : "border-pink-300 text-pink-600 dark:border-pink-700 dark:text-pink-400"
                    )}>
                      {member.gender === "Male" ? "♂" : "♀"}
                    </Badge>
                    {member.has_wheelchair && (
                      <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400">
                        ♿
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="gap-1" onClick={() => startEditFamily(member)}>
                      <Edit className="h-3 w-3" />
                      {t("common.edit")}
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive gap-1" onClick={() => handleRemoveFamily(member.id)}>
                      <Trash2 className="h-3 w-3" />
                      {t("common.delete")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {isServant && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Car className="h-5 w-5" />
              {t("cars.register")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              {t("settings.carSeatsHint")}
            </p>

            <div className="flex items-center gap-3">
              <Switch
                checked={hasCar}
                onCheckedChange={setHasCar}
              />
              <Label className="text-base">{t("settings.hasCar")}</Label>
            </div>

            {hasCar && (
              <div className="space-y-2">
                <Label>{t("settings.carSeats")}</Label>
                <Input
                  type="number"
                  className="w-24 text-center"
                  value={carSeats}
                  onChange={(e) => setCarSeats(Math.max(1, parseInt(e.target.value) || 1))}
                  min="1"
                  max="20"
                  dir="ltr"
                />
              </div>
            )}

            <Button
              onClick={handleSaveCar}
              disabled={savingCar}
            >
              {savingCar ? t("common.loading") : t("common.save")}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
