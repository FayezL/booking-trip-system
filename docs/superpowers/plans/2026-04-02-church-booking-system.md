# CTRMS — Church Trip & Room Management System: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a bilingual (AR/EN) web app for managing church trips, bus bookings, and room assignments with elderly-friendly patient UI and full servant admin dashboard.

**Architecture:** Next.js 14 App Router with TypeScript. Supabase for PostgreSQL + Auth + Edge Functions. Tailwind CSS with elderly-friendly design tokens (18px base font, 48px min button height). Custom i18n dictionary approach (no URL prefixes). Route groups: `(authenticated)` for logged-in users, flat routes for auth pages.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Supabase (@supabase/ssr, @supabase/supabase-js), pdf-lib (PDF generation), Jest + React Testing Library (tests)

---

## File Structure

```
src/
  app/
    layout.tsx                          # Root layout: I18nProvider + ToastProvider
    page.tsx                            # Redirect to /trips
    login/page.tsx                      # Phone + password login
    signup/page.tsx                     # Registration form
    (authenticated)/
      layout.tsx                        # Auth guard + Header
      trips/
        page.tsx                        # Patient: list open trips + book
        [tripId]/
          buses/page.tsx                # Patient: choose bus
      admin/
        page.tsx                        # Servant: dashboard
        trips/
          page.tsx                      # Servant: trip CRUD
          [id]/
            page.tsx                    # Trip detail hub (3 tabs)
            BusesTab.tsx                # Bus CRUD
            RoomsTab.tsx                # Room CRUD + click-to-assign
            UnbookedTab.tsx             # Unbooked users + register patient
        reports/page.tsx                # Generate PDF reports
  components/
    Header.tsx                          # Nav bar with role-based links
    LanguageToggle.tsx                  # AR/EN toggle
    Toast.tsx                           # Toast notification container
    LoadingSpinner.tsx                  # Reusable spinner
  lib/
    supabase/
      client.ts                        # Browser Supabase client
      server.ts                        # Server Supabase client
      middleware.ts                     # Auth session refresh + redirects
    i18n/
      context.tsx                       # I18nProvider + useI18n hook
      useTranslation.ts                 # t() function
      dictionaries/
        ar.json                         # Arabic translations
        en.json                         # English translations
    toast/context.tsx                   # ToastProvider + useToast hook
    pdf/generate-report.ts             # Client-side PDF generation
    types/database.ts                   # TypeScript interfaces
  middleware.ts                         # Next.js middleware entry

supabase/
  migrations/
    00001_create_profiles.sql           # profiles table + auth trigger
    00002_create_trips.sql              # trips table
    00003_create_buses.sql              # buses table
    00004_create_rooms.sql              # rooms table
    00005_create_bookings.sql           # bookings table + unique index
    00006_auth_trigger.sql              # Auth user creation trigger
    00007_enable_rls.sql                # RLS policies
    00008_create_rpc_functions.sql      # register_and_book, assign_room, cancel_booking
    00009_servant_insert_profiles.sql   # Servant profile insert policy
  functions/
    generate-report/index.ts            # PDF Edge Function (Deno)
```

---

## Phase 1: Project Scaffolding & Database (Tasks 1-6)

> Detailed in: `docs/superpowers/plans/2026-04-02-phase1-scaffolding.md`

| Task | Description | Key Files |
|------|-------------|-----------|
| 1 | Initialize Next.js + install Supabase | `package.json`, `src/app/layout.tsx` |
| 2 | Tailwind config + elderly-friendly globals | `tailwind.config.ts`, `src/app/globals.css` |
| 3 | Supabase client utilities | `src/lib/supabase/client.ts`, `server.ts`, `middleware.ts` |
| 4 | DB migrations: all 5 tables + indexes | `supabase/migrations/00001-00006` |
| 5 | RPC functions (register_and_book, assign_room, cancel_booking) | `supabase/migrations/00008` |
| 6 | TypeScript types for DB schema | `src/lib/types/database.ts` |

## Phase 2: Auth & i18n (Tasks 7-12)

> Detailed in: `docs/superpowers/plans/2026-04-02-phase2-auth.md`

| Task | Description | Key Files |
|------|-------------|-----------|
| 7 | I18n context + RTL support + LanguageToggle | `src/lib/i18n/context.tsx`, `src/components/LanguageToggle.tsx` |
| 8 | AR/EN translation dictionaries + useTranslation hook | `src/lib/i18n/dictionaries/ar.json`, `en.json`, `useTranslation.ts` |
| 9 | Login page (phone + password) | `src/app/login/page.tsx` |
| 10 | Signup page (phone + name + gender + password) | `src/app/signup/page.tsx` |
| 11 | Header component with role-based nav + logout | `src/components/Header.tsx` |
| 12 | RPC functions for booking operations | `supabase/migrations/00008_create_rpc_functions.sql` |

## Phase 3: Patient UI (Tasks 13-19)

> Detailed in: `docs/superpowers/plans/2026-04-02-phase3-patient-ui.md`

| Task | Description | Key Files |
|------|-------------|-----------|
| 13 | Toast notification system | `src/lib/toast/context.tsx`, `src/components/Toast.tsx` |
| 14 | Patient layout with auth guard + header | `src/app/(authenticated)/layout.tsx` |
| 15 | Choose Trip screen (open trips + booking status) | `src/app/(authenticated)/trips/page.tsx` |
| 16 | Choose Bus screen (capacity bars + select) | `src/app/(authenticated)/trips/[tripId]/buses/page.tsx` |
| 17 | Confirmation screen (green check + details) | (handled inline with redirect) |
| 18 | (no-op) Login/signup already outside route group | — |
| 19 | Reusable CapacityBar component | `src/components/CapacityBar.tsx` |

## Phase 4: Servant Admin UI (Tasks 20-28)

> Detailed in: `docs/superpowers/plans/2026-04-02-phase4-admin-ui.md`

| Task | Description | Key Files |
|------|-------------|-----------|
| 20 | Admin layout with servant role guard | `src/app/admin/layout.tsx` |
| 21 | Dashboard with trip stats cards | `src/app/admin/page.tsx` |
| 22 | Trip management CRUD | `src/app/admin/trips/page.tsx` |
| 23 | Trip detail hub (3-tab layout) | `src/app/admin/trips/[id]/page.tsx` |
| 24 | Buses tab (CRUD + capacity display) | `src/app/admin/trips/[id]/BusesTab.tsx` |
| 25 | Rooms tab (CRUD + click-to-assign UI) | `src/app/admin/trips/[id]/RoomsTab.tsx` |
| 26 | Unbooked tab (register + book-on-behalf) | `src/app/admin/trips/[id]/UnbookedTab.tsx` |
| 27 | Reports page (bus + room PDF generation) | `src/app/admin/reports/page.tsx` |
| 28 | (no-op) Dashboard already handles root | — |

## Phase 5: RLS, PDF & Integration (Tasks 29-31)

> Detailed in: `docs/superpowers/plans/2026-04-02-phase5-rls-pdf.md`

| Task | Description | Key Files |
|------|-------------|-----------|
| 29 | RLS policies for all 5 tables | `supabase/migrations/00008_create_rls_policies.sql` |
| 30 | PDF Edge Function (bus + room reports) | `supabase/functions/generate-report/index.ts` |
| 31 | Root page redirect to /trips | `src/app/page.tsx` |

---

## Implementation Status

**All code is implemented.** 10 commits, 31 source files, 11 migrations, 103 tests passing.

### Spec Coverage Checklist

| Spec Section | Covered | Implementation |
|---|---|---|
| 1. Roles (patient/servant) | ✅ | Profile role field, RLS policies, layout guards |
| 2. DB Schema (5 tables) | ✅ | Migrations 00001-00005 |
| 3. Auth (phone+password) | ✅ | phone@church.local hack, signup/login pages |
| 4. Patient UI (4 screens) | ✅ | Trips → Buses → Confirm flow |
| 5. Servant Admin UI | ✅ | Dashboard, CRUD, 3-tab hub, reports |
| 6. Data Integrity | ✅ | CHECK constraints, unique index, RPC functions |
| 7. PDF Reports | ✅ | Edge Function + client-side pdf-lib fallback |
| 8. RLS Policies | ✅ | is_servant() helper, per-table policies |
| 9. i18n (AR/EN) | ✅ | Dictionary approach, RTL toggle, localStorage |
| 10. Performance | ✅ | Indexes, N+1 elimination, lazy loading |
| 11. Page Routes | ✅ | All routes match spec |
