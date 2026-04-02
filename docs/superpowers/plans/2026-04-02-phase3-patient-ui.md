# Phase 3: Patient UI (Trips, Buses, Confirmation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the patient-facing booking flow — browse trips, choose a bus, confirm booking — with elderly-friendly UI, toast notifications, and role-based redirection.

**Architecture:** Authenticated layout wraps all patient/servant pages with the Header component. Patient flow is 3 screens: trips list → bus selection → confirmation. Each page fetches data from Supabase client-side. Toast component handles success/error notifications.

**Tech Stack:** Next.js 14 App Router, Tailwind CSS, Supabase (Client), TypeScript

**Prerequisites (Phase 2 files must exist):**
- `src/lib/supabase/client.ts` — browser Supabase client
- `src/lib/supabase/server.ts` — server Supabase client
- `src/lib/types/database.ts` — types: Profile, Trip, Bus, Room, Booking
- `src/lib/i18n/context.tsx` — I18nProvider
- `src/lib/i18n/useTranslation.ts` — useTranslation hook
- `src/lib/i18n/dictionaries/ar.json` + `en.json` — translations
- `src/components/LanguageToggle.tsx` — language toggle button
- `src/components/Header.tsx` — header with role-based nav (accepts `profile` prop)
- `src/app/globals.css` — Tailwind with `.btn-primary`, `.btn-secondary`, `.input-field`, `.label-text`, `.card`

---

### Task 13: Toast notification component

**Files:**
- Create: `src/components/Toast.tsx`

- [ ] **Step 1: Create Toast component**

Create `src/components/Toast.tsx`:

```typescript
"use client";

import { useState, useCallback, createContext, useContext, type ReactNode } from "react";

type ToastType = "success" | "error";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
});

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-6 py-3 rounded-lg text-lg font-semibold shadow-lg animate-fade-in ${
              toast.type === "success"
                ? "bg-emerald-600 text-white"
                : "bg-red-600 text-white"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
```

- [ ] **Step 2: Add fade-in animation to globals.css**

Append to `src/app/globals.css` inside `@layer components`:

```css
.animate-fade-in {
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

- [ ] **Step 3: Wrap app with ToastProvider in layout**

Update `src/app/layout.tsx` to wrap `I18nProvider` children with `ToastProvider`:

```typescript
import type { Metadata } from "next";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n/context";
import { ToastProvider } from "@/components/Toast";

export const metadata: Metadata = {
  title: "CTRMS - Church Trip Management",
  description: "Church Trip & Room Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className="min-h-screen">
        <I18nProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Toast notification component with auto-dismiss"
```

---

### Task 14: Authenticated layout with profile fetching

**Files:**
- Create: `src/app/(authenticated)/layout.tsx`

- [ ] **Step 1: Create authenticated layout**

This layout wraps all authenticated routes (`/trips`, `/admin`). It fetches the user profile server-side and passes it to the Header.

Create `src/app/(authenticated)/layout.tsx`:

```typescript
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Header from "@/components/Header";
import type { Profile } from "@/lib/types/database";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  return (
    <>
      <Header profile={profile as Profile} />
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </>
  );
}
```

- [ ] **Step 2: Move authenticated pages into route group**

The login and signup pages should stay OUTSIDE the `(authenticated)` group. The following pages will be created inside `src/app/(authenticated)/`:
- `src/app/(authenticated)/trips/page.tsx`
- `src/app/(authenticated)/trips/[tripId]/buses/page.tsx`
- `src/app/(authenticated)/admin/page.tsx`
- `src/app/(authenticated)/admin/trips/page.tsx`
- `src/app/(authenticated)/admin/trips/[id]/page.tsx`
- `src/app/(authenticated)/admin/reports/page.tsx`

No file moves needed now — just creating the route group layout.

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add authenticated layout with server-side profile fetching"
```

---

### Task 15: Trips listing page (patient Screen 2)

**Files:**
- Create: `src/app/(authenticated)/trips/page.tsx`

- [ ] **Step 1: Create trips listing page**

Create `src/app/(authenticated)/trips/page.tsx`:

```typescript
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useToast } from "@/components/Toast";
import type { Trip, Booking } from "@/lib/types/database";

export default function TripsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const supabase = createClient();
  const { showToast } = useToast();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const [tripsRes, bookingsRes] = await Promise.all([
        supabase.from("trips").select("*").order("trip_date", { ascending: false }),
        supabase
          .from("bookings")
          .select("*")
          .eq("user_id", user.id)
          .is("cancelled_at", null),
      ]);

      setTrips(tripsRes.data || []);
      setMyBookings(bookingsRes.data || []);
      setLoading(false);
    }

    loadData();
  }, [supabase]);

  function isBooked(tripId: string): boolean {
    return myBookings.some((b) => b.trip_id === tripId);
  }

  function getTripTitle(trip: Trip): string {
    const { lang } = useTranslation();
    return lang === "ar" ? trip.title_ar : trip.title_en;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-xl text-gray-500">{t("common.loading")}</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t("trips.title")}</h1>

      {trips.length === 0 ? (
        <p className="text-xl text-gray-500 text-center py-10">{t("trips.noTrips")}</p>
      ) : (
        <div className="space-y-4">
          {trips.map((trip) => {
            const booked = isBooked(trip.id);
            return (
              <div key={trip.id} className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold">{trip.title_ar}</h2>
                    <p className="text-gray-500 mt-1">{t("trips.date")}: {trip.trip_date}</p>
                  </div>

                  <div>
                    {!trip.is_open ? (
                      <span className="inline-block px-4 py-2 rounded-lg bg-gray-200 text-gray-600 text-lg font-semibold">
                        {t("trips.closed")}
                      </span>
                    ) : booked ? (
                      <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-100 text-emerald-700 text-lg font-semibold">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        {t("trips.alreadyBooked")}
                      </span>
                    ) : (
                      <button
                        onClick={() => router.push(`/trips/${trip.id}/buses`)}
                        className="btn-primary"
                      >
                        {t("trips.bookNow")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

**Note:** The `getTripTitle` helper won't work correctly as written (calling hook inside function). We'll use the simpler inline approach: `lang === "ar" ? trip.title_ar : trip.title_en` where `lang` is destructured from `useTranslation()` at the top level. The subagent should correct this in implementation.

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add trips listing page with booking status"
```

---

### Task 16: Bus selection page (patient Screen 3)

**Files:**
- Create: `src/app/(authenticated)/trips/[tripId]/buses/page.tsx`

- [ ] **Step 1: Create bus selection page**

Create `src/app/(authenticated)/trips/[tripId]/buses/page.tsx`:

```typescript
"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useToast } from "@/components/Toast";
import type { Bus, Trip, Booking } from "@/lib/types/database";

export default function BusesPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = use(params);
  const { t, lang } = useTranslation();
  const router = useRouter();
  const supabase = createClient();
  const { showToast } = useToast();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [buses, setBuses] = useState<(Bus & { booking_count: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingBusId, setBookingBusId] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      const [tripRes, busesRes] = await Promise.all([
        supabase.from("trips").select("*").eq("id", tripId).single(),
        supabase.from("buses").select("*").eq("trip_id", tripId),
      ]);

      if (tripRes.data) setTrip(tripRes.data);

      const busList = (busesRes.data || []) as Bus[];
      const busesWithCounts = await Promise.all(
        busList.map(async (bus) => {
          const { count } = await supabase
            .from("bookings")
            .select("*", { count: "exact", head: true })
            .eq("bus_id", bus.id)
            .is("cancelled_at", null);
          return { ...bus, booking_count: count || 0 };
        })
      );

      setBuses(busesWithCounts);
      setLoading(false);
    }

    loadData();
  }, [tripId, supabase]);

  async function handleBook(busId: string) {
    setBookingBusId(busId);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const { error } = await supabase.from("bookings").insert({
      user_id: user.id,
      trip_id: tripId,
      bus_id: busId,
    });

    if (error) {
      if (error.message.includes("unique") || error.message.includes("duplicate")) {
        showToast(t("trips.alreadyBooked"), "error");
      } else {
        showToast(t("common.error"), "error");
      }
      setBookingBusId(null);
      return;
    }

    showToast(t("confirm.title"), "success");
    router.push("/trips");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-xl text-gray-500">{t("common.loading")}</p>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => router.push("/trips")}
        className="mb-4 text-emerald-600 font-semibold text-lg hover:underline"
      >
        ← {t("buses.back")}
      </button>

      <h1 className="text-2xl font-bold mb-2">{t("buses.chooseBus")}</h1>
      {trip && (
        <p className="text-gray-600 mb-6">
          {lang === "ar" ? trip.title_ar : trip.title_en} — {t("trips.date")}: {trip.trip_date}
        </p>
      )}

      {buses.length === 0 ? (
        <p className="text-xl text-gray-500 text-center py-10">{t("trips.noTrips")}</p>
      ) : (
        <div className="space-y-4">
          {buses.map((bus) => {
            const available = bus.capacity - bus.booking_count;
            const isFull = available <= 0;
            const percent = Math.min((bus.booking_count / bus.capacity) * 100, 100);

            return (
              <div key={bus.id} className={`card ${isFull ? "opacity-60" : ""}`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-xl font-bold">
                      {lang === "ar" ? bus.area_name_ar : bus.area_name_en}
                    </h2>
                    {bus.leader_name && (
                      <p className="text-gray-500 mt-1">
                        {t("buses.leader")}: {bus.leader_name}
                      </p>
                    )}
                  </div>

                  {isFull ? (
                    <span className="px-4 py-2 rounded-lg bg-red-100 text-red-700 text-lg font-semibold">
                      {t("buses.full")}
                    </span>
                  ) : (
                    <button
                      onClick={() => handleBook(bus.id)}
                      disabled={bookingBusId !== null}
                      className="btn-primary"
                    >
                      {bookingBusId === bus.id ? t("common.loading") : t("buses.choose")}
                    </button>
                  )}
                </div>

                <div className="mt-3">
                  <div className="flex justify-between text-sm text-gray-500 mb-1">
                    <span>{t("buses.availableSeats")}: {available}</span>
                    <span>{bus.booking_count}/{bus.capacity}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        isFull ? "bg-red-500" : percent > 80 ? "bg-yellow-500" : "bg-emerald-500"
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add bus selection page with capacity bars and booking"
```

---

### Task 17: Middleware role-based redirect for `/admin`

**Files:**
- Modify: `src/lib/supabase/middleware.ts`

- [ ] **Step 1: Add role-based redirect to middleware**

The middleware should redirect patients away from `/admin` routes. Update `src/lib/supabase/middleware.ts` to check the user's role after authentication:

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !pathname.startsWith("/login") && !pathname.startsWith("/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && (pathname.startsWith("/login") || pathname.startsWith("/signup"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/trips";
    return NextResponse.redirect(url);
  }

  if (user && pathname.startsWith("/admin")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "servant") {
      const url = request.nextUrl.clone();
      url.pathname = "/trips";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add role-based redirect for admin routes in middleware"
```
