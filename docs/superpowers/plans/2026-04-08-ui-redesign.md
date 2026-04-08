# UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the entire Booking0Trip frontend with shadcn/ui components, modern clean design, and improved UX while keeping all business logic intact.

**Architecture:** Replace all hand-rolled Tailwind components with shadcn/ui primitives. Add admin sidebar navigation, breadcrumbs, Lucide icons, Sonner toasts, and skeleton loading. Every page gets rebuilt but all Supabase queries, auth, i18n, and RPC calls stay the same.

**Tech Stack:** Next.js 14, shadcn/ui (Radix + Tailwind), Lucide React, Sonner, IBM Plex Sans Arabic

---

## Task 1: Install shadcn/ui + Dependencies

**Files:**
- Create: `components.json`
- Create: `src/lib/utils.ts`
- Modify: `package.json`
- Modify: `tailwind.config.ts`
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Initialize shadcn/ui**

Run:
```bash
npx shadcn@latest init -d
```
Accept defaults. This creates `components.json`, `src/lib/utils.ts`, and updates `tailwind.config.ts` and `globals.css`.

- [ ] **Step 2: Install all needed shadcn components**

Run:
```bash
npx shadcn@latest add button card input label dialog alert-dialog badge tabs table select separator dropdown-menu sheet skeleton progress breadcrumb switch avatar tooltip scroll-area sonner
```

- [ ] **Step 3: Install Lucide React**

Run:
```bash
npm install lucide-react
```

- [ ] **Step 4: Update globals.css with complete shadcn theme**

Replace the entire `src/app/globals.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 224.3 76.3% 48%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  * {
    -webkit-tap-highlight-color: transparent;
  }
}

@layer utilities {
  .animate-fade-in {
    animation: fadeIn 0.2s ease-out;
  }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

::-webkit-scrollbar {
  height: 4px;
  width: 4px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  @apply bg-border rounded-full;
}

.hide-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.hide-scrollbar::-webkit-scrollbar {
  display: none;
}
```

- [ ] **Step 5: Update root layout with IBM Plex Sans Arabic font + Sonner**

Replace `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { I18nProvider } from "@/lib/i18n/context";
import { Toaster } from "@/components/ui/sonner";
import { Analytics } from "@vercel/analytics/next";

const font = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Verena Church - Trip Management",
  description: "Verena Church Trip & Room Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={`${font.variable} font-sans min-h-screen`}>
        <ThemeProvider attribute="class" defaultTheme="light">
          <I18nProvider>
            {children}
            <Toaster position="top-center" dir="rtl" richColors />
          </I18nProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Verify build works**

Run:
```bash
npm run build
```
Expected: Build succeeds with no errors.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: install shadcn/ui with theme, IBM Plex Sans Arabic font, and Sonner toaster"
```

---

## Task 2: Rebuild Shared Components

**Files:**
- Modify: `src/components/LanguageToggle.tsx`
- Modify: `src/components/ThemeToggle.tsx`
- Create: `src/components/AdminSidebar.tsx`
- Modify: `src/components/Header.tsx`
- Modify: `src/components/MobileNav.tsx`
- Create: `src/components/PageBreadcrumbs.tsx`

- [ ] **Step 1: Rebuild LanguageToggle with shadcn Button**

Replace `src/components/LanguageToggle.tsx`:

```tsx
"use client";

import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { Languages } from "lucide-react";

export default function LanguageToggle() {
  const { lang, setLang } = useI18n();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLang(lang === "ar" ? "en" : "ar")}
      className="gap-1.5 text-xs font-semibold"
    >
      <Languages className="h-4 w-4" />
      {lang === "ar" ? "EN" : "عربي"}
    </Button>
  );
}
```

- [ ] **Step 2: Rebuild ThemeToggle with shadcn Button + Lucide**

Replace `src/components/ThemeToggle.tsx`:

```tsx
"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-9 w-9" aria-hidden="true" />;
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}
```

- [ ] **Step 3: Create PageBreadcrumbs component**

Create `src/components/PageBreadcrumbs.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/lib/i18n/useTranslation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Fragment } from "react";

interface BreadcrumbItemData {
  label: string;
  href?: string;
}

interface PageBreadcrumbsProps {
  items: BreadcrumbItemData[];
}

export default function PageBreadcrumbs({ items }: PageBreadcrumbsProps) {
  return (
    <Breadcrumb className="mb-4">
      <BreadcrumbList>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <Fragment key={index}>
              <BreadcrumbItem>
                {isLast || !item.href ? (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={item.href}>{item.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
```

- [ ] **Step 4: Create AdminSidebar component**

Create `src/components/AdminSidebar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  Map,
  Ticket,
  FileText,
  Users,
  ScrollText,
  LogOut,
} from "lucide-react";
import type { Profile } from "@/lib/types/database";

interface AdminSidebarProps {
  profile: Profile;
}

export default function AdminSidebar({ profile }: AdminSidebarProps) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();

  function isActive(href: string): boolean {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  }

  const navItems = [
    { href: "/admin", label: t("admin.dashboard"), icon: LayoutDashboard },
    { href: "/admin/trips", label: t("admin.trips"), icon: Map },
    { href: "/trips", label: t("trips.myBookings"), icon: Ticket },
    { href: "/admin/reports", label: t("admin.reports"), icon: FileText },
    ...(profile.role === "super_admin" || profile.role === "admin"
      ? [{ href: "/admin/users", label: t("admin.users"), icon: Users }]
      : []),
    ...(profile.role === "super_admin"
      ? [{ href: "/admin/logs", label: t("admin.activityLogs"), icon: ScrollText }]
      : []),
  ];

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const initials = profile.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);

  return (
    <aside className="hidden lg:flex flex-col w-64 border-s border-border bg-card h-screen sticky top-0">
      <div className="p-6">
        <Link
          href="/admin"
          className="text-xl font-bold text-primary hover:text-primary/80 transition-colors"
        >
          Verena Church
        </Link>
      </div>

      <Separator />

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <Separator />

      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="text-xs font-semibold">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{profile.full_name}</p>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {profile.role === "super_admin"
                ? t("admin.superAdmin")
                : profile.role === "admin"
                ? t("admin.adminRole")
                : t("admin.patient")}
            </Badge>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-destructive hover:text-destructive"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          {t("auth.logout")}
        </Button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 5: Rebuild Header (patient desktop + mobile)**

Replace `src/components/Header.tsx`:

```tsx
"use client";

import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import LanguageToggle from "./LanguageToggle";
import ThemeToggle from "./ThemeToggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { LogOut, User } from "lucide-react";
import type { Profile } from "@/lib/types/database";

interface HeaderProps {
  profile: Profile;
}

export default function Header({ profile }: HeaderProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();

  const isAdmin = profile.role === "admin" || profile.role === "super_admin";

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const initials = profile.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4 md:px-6">
        <div className="flex items-center gap-2 flex-1">
          <button
            onClick={() => router.push(isAdmin ? "/admin" : "/trips")}
            className="text-lg font-bold text-primary hover:text-primary/80 transition-colors"
          >
            Verena Church
          </button>
        </div>

        <div className="flex items-center gap-1">
          <LanguageToggle />
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="flex items-center gap-2 p-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <p className="text-sm font-medium">{profile.full_name}</p>
                  <p className="text-xs text-muted-foreground">{profile.phone}</p>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive cursor-pointer">
                <LogOut className="h-4 w-4 me-2" />
                {t("auth.logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 6: Rebuild MobileNav with Lucide icons**

Replace `src/components/MobileNav.tsx`:

```tsx
"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n/useTranslation";
import {
  LayoutDashboard,
  Map,
  Ticket,
  FileText,
  Users,
  ScrollText,
} from "lucide-react";
import type { Profile } from "@/lib/types/database";

interface MobileNavProps {
  profile: Profile;
}

export default function MobileNav({ profile }: MobileNavProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();

  const isAdmin = profile.role === "admin" || profile.role === "super_admin";

  const patientTabs = [
    { label: t("trips.title"), href: "/trips", Icon: Map },
  ];

  const adminTabs = [
    { label: t("admin.dashboard"), href: "/admin", Icon: LayoutDashboard },
    { label: t("admin.trips"), href: "/admin/trips", Icon: Map },
    { label: t("trips.myBookings"), href: "/trips", Icon: Ticket },
    { label: t("admin.reports"), href: "/admin/reports", Icon: FileText },
    ...(profile.role === "super_admin" || profile.role === "admin"
      ? [{ label: t("admin.users"), href: "/admin/users", Icon: Users }]
      : []),
    ...(profile.role === "super_admin"
      ? [{ label: t("admin.activityLogs"), href: "/admin/logs", Icon: ScrollText }]
      : []),
  ];

  const tabs = isAdmin ? adminTabs : patientTabs;

  function isActive(href: string): boolean {
    if (href === "/admin") return pathname === "/admin";
    if (href === "/trips") return pathname === "/trips" || (pathname.startsWith("/trips/") && !pathname.startsWith("/admin/trips"));
    return pathname.startsWith(href);
  }

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-background/80 backdrop-blur-lg border-t md:hidden">
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const active = isActive(tab.href);
          return (
            <button
              key={tab.href}
              onClick={() => router.push(tab.href)}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors cursor-pointer ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <tab.Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium leading-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
```

- [ ] **Step 7: Update authenticated layout with sidebar for admin**

Replace `src/app/(authenticated)/layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import Header from "@/components/Header";
import MobileNav from "@/components/MobileNav";
import AdminSidebar from "@/components/AdminSidebar";
import type { Profile } from "@/lib/types/database";

const getProfile = cache(async (userId: string) => {
  const supabase = await createClient();
  return supabase.from("profiles").select("*").eq("id", userId).single();
});

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

  const { data: profile } = await getProfile(user.id);

  if (!profile || (profile as Profile).deleted_at) {
    redirect("/login");
  }

  const p = profile as Profile;
  const isAdmin = p.role === "admin" || p.role === "super_admin";

  return (
    <>
      {isAdmin ? (
        <div className="flex min-h-screen">
          <AdminSidebar profile={p} />
          <div className="flex-1 flex flex-col min-w-0">
            <Header profile={p} />
            <main className="flex-1 p-4 md:p-6 lg:p-8 pb-24 lg:pb-8">
              {children}
            </main>
          </div>
        </div>
      ) : (
        <>
          <Header profile={p} />
          <main className="max-w-5xl mx-auto px-4 md:px-6 py-4 md:py-6 pb-24 md:pb-6">
            {children}
          </main>
        </>
      )}
      <MobileNav profile={p} />
    </>
  );
}
```

- [ ] **Step 8: Verify build works**

Run:
```bash
npm run build
```
Expected: Build succeeds.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat: rebuild shared components with shadcn/ui — sidebar, header, mobilenav, breadcrumbs"
```

---

## Task 3: Rebuild Login Page

**Files:**
- Modify: `src/app/login/page.tsx`

- [ ] **Step 1: Rebuild login page with shadcn components**

Replace `src/app/login/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, setSessionPersistence } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import LanguageToggle from "@/components/LanguageToggle";
import ThemeToggle from "@/components/ThemeToggle";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Church, Phone, KeyRound } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!phone.trim() || !/^\d{8,15}$/.test(phone.trim())) {
      setError(t("auth.phoneRequired"));
      return;
    }
    if (!password.trim() || password.length < 6) {
      setError(t("auth.passwordRequired"));
      return;
    }

    setLoading(true);
    const email = `${phone.trim()}@church.local`;
    const supabase = createClient();

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (authError) {
      setError(t("auth.invalidCredentials"));
      return;
    }

    if (!rememberMe) {
      setSessionPersistence(false);
    }

    router.push("/trips");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-background to-blue-50 dark:from-gray-950 dark:via-background dark:to-gray-950 p-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="flex justify-end mb-4 gap-1">
          <ThemeToggle />
          <LanguageToggle />
        </div>
        <Card>
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Church className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">{t("auth.login")}</h1>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">{t("auth.phone")}</Label>
                <div className="relative">
                  <Phone className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    dir="ltr"
                    disabled={loading}
                    className="ps-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{t("auth.password")}</Label>
                <div className="relative">
                  <KeyRound className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    dir="ltr"
                    disabled={loading}
                    className="ps-10"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="rememberMe"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                  disabled={loading}
                />
                <Label htmlFor="rememberMe" className="text-sm font-normal text-muted-foreground cursor-pointer">
                  {t("auth.rememberMe")}
                </Label>
              </div>

              {error && (
                <div className="rounded-lg bg-destructive/10 p-3 text-center text-sm font-medium text-destructive animate-fade-in" role="alert">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t("auth.loggingIn") : t("auth.loginButton")}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {t("auth.noAccount")}{" "}
              <Link href="/signup" className="font-semibold text-primary hover:underline">
                {t("auth.registerHere")}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify login page renders**

Run:
```bash
npm run build
```
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: rebuild login page with shadcn/ui components"
```

---

## Task 4: Rebuild Signup Page

**Files:**
- Modify: `src/app/signup/page.tsx`

- [ ] **Step 1: Rebuild signup page with shadcn components**

Replace `src/app/signup/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import LanguageToggle from "@/components/LanguageToggle";
import ThemeToggle from "@/components/ThemeToggle";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { UserPlus, Phone, User, KeyRound } from "lucide-react";
import Link from "next/link";

type SignupRole = "patient" | "companion" | "family_assistant";

export default function SignupPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState<"Male" | "Female" |="">("");
  const [role, setRole] = useState<SignupRole | "">("");
  const [hasWheelchair, setHasWheelchair] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!phone.trim() || !/^\d{8,15}$/.test(phone.trim())) {
      setError(t("auth.phoneRequired"));
      return;
    }
    if (!fullName.trim()) {
      setError(t("auth.nameRequired"));
      return;
    }
    if (!gender) {
      setError(t("auth.genderRequired"));
      return;
    }
    if (!role) {
      setError(t("auth.userType"));
      return;
    }
    if (!password.trim() || password.length < 6) {
      setError(t("auth.passwordRequired"));
      return;
    }

    setLoading(true);
    const email = `${phone.trim()}@church.local`;
    const supabase = createClient();

    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          gender,
          role,
          has_wheelchair: hasWheelchair,
        },
      },
    });

    setLoading(false);

    if (authError) {
      if (authError.message.includes("already registered")) {
        setError(t("auth.phoneExists"));
      } else {
        setError(t("common.error"));
      }
      return;
    }

    router.push("/trips");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-background to-blue-50 dark:from-gray-950 dark:via-background dark:to-gray-950 p-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="flex justify-end mb-4 gap-1">
          <ThemeToggle />
          <LanguageToggle />
        </div>
        <Card>
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <UserPlus className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">{t("auth.signup")}</h1>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">{t("auth.phone")}</Label>
                <div className="relative">
                  <Phone className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    dir="ltr"
                    disabled={loading}
                    className="ps-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fullName">{t("auth.fullName")}</Label>
                <div className="relative">
                  <User className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={loading}
                    className="ps-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("auth.gender")}</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={gender === "Male" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setGender("Male")}
                    disabled={loading}
                  >
                    {t("auth.male")}
                  </Button>
                  <Button
                    type="button"
                    variant={gender === "Female" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setGender("Female")}
                    disabled={loading}
                  >
                    {t("auth.female")}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("auth.userType")}</Label>
                <div className="flex gap-2 flex-wrap">
                  {(["patient", "companion", "family_assistant"] as const).map((r) => (
                    <Button
                      key={r}
                      type="button"
                      variant={role === r ? "default" : "outline"}
                      size="sm"
                      className="flex-1 min-w-[80px]"
                      onClick={() => {
                        setRole(r);
                        if (r !== "patient") setHasWheelchair(false);
                      }}
                      disabled={loading}
                    >
                      {t(`admin.${r === "patient" ? "patient" : r === "companion" ? "companion" : "familyAssistant"}`)}
                    </Button>
                  ))}
                </div>
              </div>

              {role === "patient" && (
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <Label htmlFor="wheelchair" className="text-sm font-normal cursor-pointer">
                    {t("auth.wheelchair")}
                  </Label>
                  <Switch
                    id="wheelchair"
                    checked={hasWheelchair}
                    onCheckedChange={setHasWheelchair}
                    disabled={loading}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">{t("auth.password")}</Label>
                <div className="relative">
                  <KeyRound className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    dir="ltr"
                    disabled={loading}
                    className="ps-10"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-lg bg-destructive/10 p-3 text-center text-sm font-medium text-destructive animate-fade-in" role="alert">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t("auth.signingUp") : t("auth.signupButton")}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {t("auth.hasAccount")}{" "}
              <Link href="/login" className="font-semibold text-primary hover:underline">
                {t("auth.loginHere")}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run:
```bash
npm run build
```
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: rebuild signup page with shadcn/ui components"
```

---

## Task 5: Rebuild Patient Trips Page

**Files:**
- Modify: `src/app/(authenticated)/trips/page.tsx`

- [ ] **Step 1: Read current trips page to preserve all business logic**

Read `src/app/(authenticated)/trips/page.tsx` — keep all state, Supabase queries, booking logic. Only replace JSX with shadcn components. Add breadcrumb. Replace card/badge/button CSS classes with shadcn equivalents. Replace inline SVGs with Lucide icons. Add skeleton loading.

- [ ] **Step 2: Rebuild the page**

Replace the page keeping all logic but with shadcn Card, Badge, Button, Skeleton, Separator components. Add PageBreadcrumbs. Replace `LoadingSpinner` with Skeleton cards. Use `Calendar`, `Users`, `ChevronDown`, `CalendarX` from Lucide.

The exact structure:
- PageBreadcrumbs with `[t("trips.title")]`
- Trip cards in a grid using shadcn Card
- Each card: title, date (Calendar icon), passenger count (Users icon), Book Now Button or Badge
- My Bookings section with Separator
- Empty state with CalendarX icon
- Loading state with Skeleton cards

- [ ] **Step 3: Verify build**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: rebuild patient trips page with shadcn/ui and breadcrumbs"
```

---

## Task 6: Rebuild Bus Selection Page

**Files:**
- Modify: `src/app/(authenticated)/trips/[tripId]/buses/page.tsx`

- [ ] **Step 1: Read current buses page to preserve all business logic**

Read `src/app/(authenticated)/trips/[tripId]/buses/page.tsx` — keep all state, booking logic, confirmation flow.

- [ ] **Step 2: Rebuild the page**

Replace with shadcn Card, Button, Badge, Progress, Dialog, Skeleton. Add PageBreadcrumbs `[t("trips.title") → "/trips", tripTitle]`. Back button with `ArrowRight` (RTL) Lucide icon. Use shadcn Progress for capacity bars. Booking confirmation uses shadcn Dialog instead of inline card. Replace inline SVGs with Lucide icons.

- [ ] **Step 3: Verify build**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: rebuild bus selection page with shadcn/ui and dialog confirmation"
```

---

## Task 7: Rebuild Admin Dashboard

**Files:**
- Modify: `src/app/(authenticated)/admin/page.tsx`

- [ ] **Step 1: Read current admin dashboard to preserve all business logic**

Read `src/app/(authenticated)/admin/page.tsx` — keep all Supabase queries, stat calculations, trip listing.

- [ ] **Step 2: Rebuild the page**

Replace with shadcn Card, Skeleton, Badge. Add PageBreadcrumbs `[t("admin.dashboard")]`. Use stat cards with icons (Users, CheckCircle, XCircle, Bus, BedDouble from Lucide). Skeleton loading matching card grid shape.

- [ ] **Step 3: Verify build**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: rebuild admin dashboard with shadcn/ui cards and skeleton loading"
```

---

## Task 8: Rebuild Admin Trips Page

**Files:**
- Modify: `src/app/(authenticated)/admin/trips/page.tsx`

- [ ] **Step 1: Read current admin trips page to preserve all business logic**

Read `src/app/(authenticated)/admin/trips/page.tsx` — keep CRUD logic, inline form state, trip operations.

- [ ] **Step 2: Rebuild the page**

Replace inline create/edit form with shadcn Dialog modal. Replace card list with shadcn Card + Badge + Button. Add PageBreadcrumbs `[t("admin.dashboard") → "/admin", t("admin.trips")]`. Delete confirmation uses shadcn AlertDialog. Use Lucide icons (Plus, Pencil, Trash2, ExternalLink).

- [ ] **Step 3: Verify build**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: rebuild admin trips page with shadcn dialogs and alert dialogs"
```

---

## Task 9: Rebuild Admin Trip Detail (4 Tabs)

**Files:**
- Modify: `src/app/(authenticated)/admin/trips/[id]/page.tsx`
- Modify: `src/app/(authenticated)/admin/trips/[id]/OverviewTab.tsx`
- Modify: `src/app/(authenticated)/admin/trips/[id]/BusesTab.tsx`
- Modify: `src/app/(authenticated)/admin/trips/[id]/RoomsTab.tsx`
- Modify: `src/app/(authenticated)/admin/trips/[id]/UnbookedTab.tsx`

- [ ] **Step 1: Read all 5 files to preserve all business logic**

Read the trip detail page and all 4 tab components. Keep all state, Supabase queries, CRUD operations, passenger management, room assignment logic.

- [ ] **Step 2: Rebuild the trip detail page**

Replace tab navigation with shadcn Tabs. Add PageBreadcrumbs `[t("admin.dashboard") → "/admin", t("admin.trips") → "/admin/trips", tripTitle]`. Back button with Lucide ArrowRight.

- [ ] **Step 3: Rebuild OverviewTab**

Replace with shadcn Card for stats, shadcn Progress for area overview. Use Lucide icons for each stat type.

- [ ] **Step 4: Rebuild BusesTab**

Replace inline forms with shadcn Dialog. Replace confirm() with shadcn AlertDialog. Use shadcn Table for passenger lists. Replace progress bar CSS with shadcn Progress. Use Lucide icons (Plus, Pencil, Trash2, Move, UserMinus, ChevronDown, Users).

- [ ] **Step 5: Rebuild RoomsTab**

Replace inline forms with shadcn Dialog. Use shadcn ScrollArea for room lists. Keep click-to-assign UX but with better visual feedback (highlighted state on selected person). Use shadcn Badge for room status. Gender tabs use shadcn Tabs.

- [ ] **Step 6: Rebuild UnbookedTab**

Replace inline register form with shadcn Dialog. Use shadcn Table for user list. Search uses shadcn Input with Search icon. Gender filter uses Button variants.

- [ ] **Step 7: Verify build**

Run: `npm run build`

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: rebuild admin trip detail with shadcn tabs, dialogs, tables"
```

---

## Task 10: Rebuild Admin Users Page

**Files:**
- Modify: `src/app/(authenticated)/admin/users/page.tsx`

- [ ] **Step 1: Read current users page to preserve all business logic**

Read `src/app/(authenticated)/admin/users/page.tsx` — keep all CRUD, role change, password reset, delete logic.

- [ ] **Step 2: Rebuild the page**

Replace inline create form with shadcn Dialog. Replace card list with shadcn Table. Add PageBreadcrumbs `[t("admin.dashboard") → "/admin", t("admin.users")]`. Delete confirmation with shadcn AlertDialog. Password reset with shadcn Dialog. Search with shadcn Input + Search icon. Role filter with shadcn Select. Use Lucide icons throughout.

- [ ] **Step 3: Verify build**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: rebuild admin users page with shadcn data table and dialogs"
```

---

## Task 11: Rebuild Admin Logs Page

**Files:**
- Modify: `src/app/(authenticated)/admin/logs/page.tsx`

- [ ] **Step 1: Read current logs page to preserve all business logic**

Read `src/app/(authenticated)/admin/logs/page.tsx` — keep all query, filter, pagination logic.

- [ ] **Step 2: Rebuild the page**

Replace card list with shadcn Table. Add PageBreadcrumbs `[t("admin.dashboard") → "/admin", t("admin.activityLogs")]`. Action filter with shadcn Select. Badges for action types. Pagination at bottom.

- [ ] **Step 3: Verify build**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: rebuild admin logs page with shadcn data table"
```

---

## Task 12: Rebuild Admin Reports Page

**Files:**
- Modify: `src/app/(authenticated)/admin/reports/page.tsx`

- [ ] **Step 1: Read current reports page to preserve all business logic**

Read `src/app/(authenticated)/admin/reports/page.tsx` — keep PDF generation logic.

- [ ] **Step 2: Rebuild the page**

Replace with shadcn Card, Select, Button. Add PageBreadcrumbs `[t("admin.dashboard") → "/admin", t("admin.reports")]`. Use Lucide icons (Bus, BedDouble, Download). Loading skeleton during generation. Use Sonner toast for success.

- [ ] **Step 3: Verify build**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: rebuild admin reports page with shadcn select and loading states"
```

---

## Task 13: Update Toast Usage + Cleanup

**Files:**
- Modify: Every page that uses `useToast()` from `@/components/Toast`
- Delete: `src/components/Toast.tsx`
- Delete: `src/components/LoadingSpinner.tsx`
- Add new i18n keys for breadcrumb labels

- [ ] **Step 1: Find all files importing old Toast**

Run:
```bash
grep -rl "useToast.*from.*@/components/Toast" src/
```

- [ ] **Step 2: Replace all toast usage with Sonner**

In every file found, replace:
```tsx
import { useToast } from "@/components/Toast";
// ...
const { showToast } = useToast();
// ...
showToast("message");
```

With:
```tsx
import { toast } from "sonner";
// ...
toast.success("message");
toast.error("message");
```

- [ ] **Step 3: Delete deprecated components**

Delete `src/components/Toast.tsx` and `src/components/LoadingSpinner.tsx`.

- [ ] **Step 4: Add new i18n keys for breadcrumbs**

Add to both `ar.json` and `en.json` under a new `nav` section:

```json
"nav": {
  "home": "الرئيسية",
  "dashboard": "لوحة التحكم",
  "trips": "الرحلات",
  "users": "الأشخاص",
  "logs": "سجل الأنشطة",
  "reports": "التقارير"
}
```

```json
"nav": {
  "home": "Home",
  "dashboard": "Dashboard",
  "trips": "Trips",
  "users": "Users",
  "logs": "Activity Logs",
  "reports": "Reports"
}
```

- [ ] **Step 5: Verify build and run dev server**

Run:
```bash
npm run build && npm run dev
```
Expected: Build succeeds, all pages render correctly.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: migrate to Sonner toast, cleanup deprecated components, add breadcrumb i18n keys"
```

---

## Task 14: Final Verification + Dark Mode Testing

**Files:**
- None (testing only)

- [ ] **Step 1: Run build**

```bash
npm run build
```
Expected: Clean build with no errors.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```
Expected: No new errors (existing exhaustive-deps warnings are acceptable).

- [ ] **Step 3: Manual test checklist**

Verify in browser at `http://localhost:3000`:
- [ ] Login page renders with new design
- [ ] Signup page renders with new design
- [ ] Dark mode toggle works on every page
- [ ] Language toggle works (AR ↔ EN)
- [ ] Patient trips page shows breadcrumbs, cards, badges
- [ ] Bus selection page shows progress bars, booking dialog
- [ ] Admin sidebar shows on desktop (lg+)
- [ ] Admin mobile nav shows on mobile
- [ ] All admin pages show breadcrumbs
- [ ] Create/Edit dialogs work (trips, buses, rooms, users)
- [ ] Delete confirmations use AlertDialog (not browser confirm)
- [ ] Toasts appear via Sonner
- [ ] Skeleton loading on all pages
- [ ] RTL layout is correct throughout
- [ ] Back navigation works correctly

- [ ] **Step 4: Final commit**

```bash
git add -A && git commit -m "feat: complete UI redesign with shadcn/ui — modern clean design system"
```
