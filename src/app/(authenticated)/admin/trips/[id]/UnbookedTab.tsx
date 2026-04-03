"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useToast } from "@/components/Toast";
import LoadingSpinner from "@/components/LoadingSpinner";
import { logAction } from "@/lib/admin-logs";
import type { Profile, Bus } from "@/lib/types/database";

type RegisterForm = {
  phone: string;
  full_name: string;
  gender: "Male" | "Female";
  password: string;
  bus_id: string;
};

const emptyForm: RegisterForm = {
  phone: "",
  full_name: "",
  gender: "Male",
  password: "",
  bus_id: "",
};

export default function UnbookedTab({ tripId }: { tripId: string }) {
  const { t, lang } = useTranslation();
  const supabase = createClient();
  const { showToast } = useToast();

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

    const [allBookedRes, profilesRes, busListRes] = await Promise.all([
      supabase.from("bookings").select("user_id").eq("trip_id", tripId).is("cancelled_at", null),
      supabase.from("profiles").select("*").neq("id", user.id).order("full_name"),
      supabase.from("buses").select("*").eq("trip_id", tripId),
    ]);

    const bookedIds = new Set((allBookedRes.data || []).map((b: { user_id: string }) => b.user_id));
    const unbookedProfiles = (profilesRes.data || []).filter((p: Profile) => !bookedIds.has(p.id));

    setUnbooked(unbookedProfiles);
    setBuses(busListRes.data || []);
    setLoading(false);
  }

  function startBookForUser(userId: string) {
    setBookingUser(userId);
    setSelectedBus(buses.length > 0 ? buses[0].id : "");
  }

  async function confirmBookForUser() {
    if (!bookingUser || !selectedBus) {
      showToast(t("common.error"), "error");
      return;
    }

    const { error } = await supabase.rpc("book_bus", {
      p_user_id: bookingUser,
      p_trip_id: tripId,
      p_bus_id: selectedBus,
    });

    if (error) {
      showToast(t("common.error"), "error");
    } else {
      showToast(t("admin.book"), "success");
      logAction("book_user", "booking", undefined, { user_id: bookingUser });
      setBookingUser(null);
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
    });

    setSaving(false);

    if (error) {
      if (error.message.includes("already registered") || error.message.includes("unique")) {
        showToast(t("auth.phoneExists"), "error");
        setShowRegister(false);
        setForm(emptyForm);
        loadData();
      } else {
        showToast(error.message, "error");
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
    return <LoadingSpinner text={t("common.loading")} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold">{t("admin.unbooked")}</h2>
          <p className="text-sm text-gray-500">
            {unbooked.length} {t("admin.unbooked")} ({maleCount}M, {femaleCount}F)
          </p>
        </div>
        <button onClick={() => setShowRegister(!showRegister)} className="btn-primary">
          + {t("admin.registerPatient")}
        </button>
      </div>

      {showRegister && (
        <div className="card mb-4">
          <h3 className="text-lg font-bold mb-3">{t("admin.registerPatient")}</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label-text">{t("auth.phone")}</label>
              <input
                className="input-field"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="01XXXXXXXXX"
                dir="ltr"
              />
            </div>
            <div>
              <label className="label-text">{t("auth.fullName")}</label>
              <input
                className="input-field"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>
            <div>
              <label className="label-text">{t("auth.gender")}</label>
              <select
                className="input-field"
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
              <label className="label-text">{t("auth.password")}</label>
              <input
                type="password"
                className="input-field"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                dir="ltr"
              />
            </div>
            <div className="md:col-span-2">
              <label className="label-text">{t("buses.chooseBus")} ({t("admin.cancel")})</label>
              <select
                className="input-field"
                value={form.bus_id}
                onChange={(e) => setForm({ ...form, bus_id: e.target.value })}
              >
                <option value="">---</option>
                {buses.map((bus) => (
                  <option key={bus.id} value={bus.id}>
                    {lang === "ar" ? bus.area_name_ar : bus.area_name_en}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handleRegister} disabled={saving} className="btn-primary">
              {saving ? t("common.loading") : t("admin.registerPatient")}
            </button>
            <button onClick={() => setShowRegister(false)} className="btn-secondary">
              {t("admin.cancel")}
            </button>
          </div>
        </div>
      )}

      {bookingUser && (
        <div className="card mb-4">
          <h3 className="text-lg font-bold mb-3">{t("admin.book")}</h3>
          <div>
            <label className="label-text">{t("buses.chooseBus")}</label>
            <select
              className="input-field"
              value={selectedBus}
              onChange={(e) => setSelectedBus(e.target.value)}
            >
              {buses.map((bus) => (
                <option key={bus.id} value={bus.id}>
                  {lang === "ar" ? bus.area_name_ar : bus.area_name_en}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={confirmBookForUser} className="btn-primary">
              {t("admin.book")}
            </button>
            <button onClick={() => setBookingUser(null)} className="btn-secondary">
              {t("admin.cancel")}
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-3 mb-4">
        <input
          className="input-field max-w-xs"
          placeholder={t("admin.searchByName")}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <div className="flex gap-1">
          {(["", "Male", "Female"] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGenderFilter(g)}
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                genderFilter === g
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {g === "" ? t("admin.all") : g === "Male" ? t("auth.male") : t("auth.female")}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-gray-500 text-center py-4">{t("admin.noBookings")}</p>
        ) : (
          <>
            {paginated.map((p) => (
              <div key={p.id} className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">{p.full_name}</span>
                    <span className="text-sm text-gray-500 ms-2" dir="ltr">{p.phone}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded ms-2 ${
                        p.gender === "Male"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-pink-100 text-pink-700"
                      }`}
                    >
                      {p.gender === "Male" ? t("auth.male") : t("auth.female")}
                    </span>
                  </div>
                  <button
                    onClick={() => startBookForUser(p.id)}
                    className="btn-primary text-sm py-1.5 px-3"
                  >
                    {t("admin.book")}
                  </button>
                </div>
              </div>
            ))}
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
          </>
        )}
      </div>
    </div>
  );
}
