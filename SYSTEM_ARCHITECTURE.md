# System Architecture

> How the Booking-Trip System is built, deployed, and kept safe across production and demo environments.

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        GitHub Repository                         │
│                            (main)                                │
└──────┬───────────────────────────────────────┬──────────────────┘
       │                                       │
       │ auto-deploy                           │ cron 03:00 UTC
       ▼                                       ▼
┌─────────────────┐                    ┌──────────────────┐
│  Vercel: Prod   │                    │  GitHub Actions  │
│  APP_ENV=prod   │                    │  Nightly Reset   │
└────────┬────────┘                    └────────┬─────────┘
         │                                      │
         │           ┌─────────────────┐        │ cleanup + seed
         │           │  Vercel: Demo   │        │ (admin API)
         │           │  APP_ENV=demo   │        │
         │           └────────┬────────┘        │
         │                    │                 │
         ▼                    ▼                 ▼
┌──────────────────────────────────────────────────────────────────┐
│              Supabase: Production            Supabase: Demo       │
│              200+ real users                 100 fictional users  │
│              (private)                       (reset nightly)      │
└──────────────────────────────────────────────────────────────────┘
```

**One codebase, two environments.** Selected at build time by `NEXT_PUBLIC_APP_ENV`:

| Environment | Purpose | Database | Accounts |
|---|---|---|---|
| **Production** | Real church members | Live Supabase project | 200+ real users (private) |
| **Demo** | Public showcase | Isolated demo Supabase project | 100 fictional users, reset nightly |

Default (env var unset) = production. There is no runtime switch — the variable is inlined into the JavaScript bundle at build time, so the demo UI is literally stripped from the production build.

---

## Request Flow (Authentication + Data)

```mermaid
sequenceDiagram
    participant U as User
    participant N as Next.js
    participant A as Supabase Auth
    participant D as PostgreSQL (RLS)

    U->>N: Visit /login
    N->>U: Render page (demo banner only if APP_ENV=demo)
    U->>N: Phone + password
    N->>A: signInWithPassword(email = phone@church.local)
    A->>A: Verify bcrypt hash
    A-->>N: JWT access token
    N->>D: Query with JWT
    D->>D: RLS policy check (auth.uid)
    D-->>N: Only the user's own rows
    N-->>U: Rendered page
```

**Key security properties:**

- Passwords hashed with bcrypt (`crypt(pw, gen_salt('bf'))`)
- JWT stored in HttpOnly cookie (not accessible to JS)
- Every table has Row Level Security enabled
- Patients can only SELECT/INSERT their own bookings; admins pass an `is_admin()` check
- No user enumeration (login errors are generic)

---

## "Try Demo" Flow (Demo Only)

When a visitor clicks **Try Demo** on the demo site:

```mermaid
sequenceDiagram
    participant V as Visitor
    participant N as Next.js (Demo)
    participant F as claim_demo_account()
    participant P as demo_account_pool
    participant A as Supabase Auth

    V->>N: Click "Try Demo"
    N->>F: RPC call (anon key)
    F->>P: SELECT phone WHERE no active booking
    P-->>F: Least-recently-assigned phone
    F->>P: UPDATE last_assigned_at = now()
    F-->>N: Phone (e.g. "09900010021")
    N->>A: signInWithPassword(phone@church.local, "demo123")
    A-->>N: JWT
    N->>V: Redirect to /trips
```

**Why round-robin:** Each visitor gets a distinct fictional account (via `FOR UPDATE SKIP LOCKED`), so concurrent visitors don't share sessions or collide on bookings.

**Why prefer unbooked:** 40 of the 100 demo accounts have pre-seeded bookings (makes the demo look alive). `claim_demo_account` skips them first so new visitors can book fresh, then falls back to booked accounts once all 60 unbooked are taken.

---

## Data Model

```mermaid
erDiagram
    profiles ||--o{ family_members : "has"
    profiles ||--o{ bookings : "owns"
    trips ||--o{ buses : "has"
    trips ||--o{ rooms : "has"
    trips ||--o{ bookings : "has"
    buses ||--o{ bookings : "seats"
    rooms ||--o{ bookings : "assigns"
    family_members ||--o{ bookings : "per-person"
    sectors ||--o{ profiles : "groups"

    profiles {
        uuid id PK
        text phone UK
        text full_name
        text role
        uuid sector_id FK
    }
    family_members {
        uuid id PK
        uuid head_user_id FK
        boolean is_head
        text role
        text transport_type
    }
    trips {
        uuid id PK
        text title_en
        date trip_date
        boolean is_open
    }
    bookings {
        uuid id PK
        uuid user_id FK
        uuid trip_id FK
        uuid bus_id FK
        uuid room_id FK
        uuid family_member_id FK
        timestamptz cancelled_at
    }
```

**Key design choices:**

- **Head-as-member model (post-00101):** the account owner is a `family_members` row with `is_head=true`. Bookings target `family_member_id`, so a head + 2 relatives = 3 booking rows. This unifies the booking path.
- **Soft delete:** bookings use `cancelled_at` (nullable); profiles use `deleted_at`. Queries filter on these.
- **Two partial unique indexes** prevent double-booking: one head booking per trip, one booking per family member per trip.

---

## Nightly Demo Reset (CI/CD)

```mermaid
graph LR
    CRON[Cron: 03:00 UTC] --> ACTION[GitHub Actions]
    ACTION -->|node scripts/cleanup| CLEAN[cleanup-demo-data.mjs]
    CLEAN -->|admin.deleteUser x100| DB1[(Demo DB:<br/>empty)]
    DB1 -->|node scripts/seed| SEED[seed-demo-data.mjs]
    SEED -->|admin.createUser x100| DB2[(Demo DB:<br/>fresh data)]
    SEED -->|upsert trips/buses/rooms| DB2
    SEED -->|insert bookings + pool| DB2
```

| Step | Script | What it does | Time |
|---|---|---|---|
| 1 | `scripts/cleanup-demo-data.mjs` | Delete demo trips (cascade), delete 100 auth users via admin API, truncate pool | ~23s |
| 2 | `scripts/seed-demo-data.mjs` | Create 100 users via `admin.createUser()` (auth.identities + profile + family_member auto-created by trigger), upsert 2 trips / 8 buses / 10 rooms, insert 40 bookings, populate pool | ~25s |

**Why Node.js (not SQL):** `supabase.auth.admin.createUser()` is the only supported way to create users — it populates `auth.users` + `auth.identities` together and fires the signup trigger. Direct SQL inserts skip `auth.identities`, which newer Supabase requires for sign-in.

**Manual trigger:** Repo → Actions → "Nightly demo reset" → "Run workflow". Useful before demos when you want fresh data immediately.

---

## Production Safety Guarantees

The nightly reset can **never** touch production:

1. **Separate credentials** — the Action only has `SUPABASE_DEMO_URL` + `SUPABASE_DEMO_SERVICE_ROLE_KEY` secrets (demo project). No production credentials exist in GitHub.
2. **Marker-based targeting** — scripts identify demo data by `phone LIKE '099%'`, `title_en LIKE '[DEMO]%'`, and UUID prefixes (`a1000000-…`, `d0000000-…`). These markers don't exist in production.
3. **Build-time gating** — `isDemo` is `false` in the production bundle. The Try Demo button, demo banner, and read-only settings guards are dead code in production.
4. **Fail-closed default** — if `NEXT_PUBLIC_APP_ENV` is unset, the code defaults to production. Misconfiguration makes the demo invisible, never the reverse.

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js 14 (App Router) | Server-rendered + client components |
| Language | TypeScript | Strict mode |
| Styling | Tailwind CSS | + shadcn/ui primitives |
| Database | Supabase (PostgreSQL) | RLS on every table |
| Auth | Supabase Auth (email) | Email format: `{phone}@church.local` — phone is the real identifier |
| Edge Functions | Supabase Edge (Deno) | PDF report generation |
| Analytics | Vercel Analytics | Privacy-friendly |
| Testing | Jest + React Testing Library | 100 tests |
| CI | GitHub Actions | Lint + test on push/PR; nightly demo reset |
| Deployment | Vercel | Two projects from one repo |

---

## Related Documentation

- **[`MAINPLAN.md`](docs/superpowers/MAINPLAN.md)** — Full project history, phase-by-phase (15 phases)
- **[`demoplan.md`](demoplan.md)** — Demo environment implementation checklist
- **[`README.md`](README.md)** — Quick start, features, badges
- **[`supabase/schema.sql`](supabase/schema.sql)** — Consolidated idempotent schema (single-file install)
