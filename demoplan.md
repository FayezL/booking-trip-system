# Demo Environment — Implementation Checklist

> Working memory list. Work top to bottom. Every code step is **gated behind `isDemo`**, so production is never affected. Tick boxes as you go.
>
> **Immediate milestone: Tasks 1–4** (env flag → Demo Banner → Try Demo button). You can stop there and the demo is functionally live.

---

## The One Rule (read first)

All demo UI is gated behind:

```ts
export const isDemo = process.env.NEXT_PUBLIC_APP_ENV === "demo";
```

- `NEXT_PUBLIC_*` is **inlined at build time**, per Vercel project.
- Production build → `isDemo = false` baked into the JS. No runtime flag can flip it.
- Default (env unset) → `false` → demo code is dead. **Misconfiguring makes the demo invisible, never the other way around.**
- Therefore: changes to existing files are safe as long as they're wrapped in `if (isDemo)` / `return null when !isDemo`.

---

## Architecture (two environments, one codebase)

```
GitHub repo (main)
 ├─ Vercel: booking-trip-system      → NEXT_PUBLIC_APP_ENV=production → real Supabase
 └─ Vercel: booking-trip-system-demo → NEXT_PUBLIC_APP_ENV=demo       → demo Supabase
```

Same code. Different env vars at build. Production project and DB stay untouched.

**Why NOT shared DB:** LinkedIn viewers would see real members' PII (names, phones, wheelchair status, room assignments) and could create/cancel real bookings. Hard no.

---

## Files map

| File | Status | Responsibility | Touches prod? |
|------|--------|----------------|---------------|
| `src/lib/env.ts` | new | `isDemo` / `isProduction` helpers | No (new file) |
| `src/components/DemoBanner.tsx` | new | top banner, demo-only | No (new file) |
| `src/app/layout.tsx` | modify | render `<DemoBanner />` | Gated — renders null in prod |
| `src/app/login/page.tsx` | modify | "Try Demo" card | Gated by `isDemo` |
| `supabase/migrations/00010_demo_pool.sql` | new | pool table + `claim_demo_account()` RPC | Harmless in prod (empty table) |
| `supabase/seed-demo-data.sql` | new | fake users/trips/buses/rooms/bookings | Demo DB only |
| `supabase/cleanup-demo-data.sql` | new | idempotent teardown | Demo DB only |
| `.github/workflows/demo-reset.yml` | new | nightly reset cron | Uses demo DB URL only |
| `src/__tests__/components/demo-banner.test.tsx` | new | banner hides in prod | No |
| `README.md` | modify | document two environments | Docs only |

---

## Phase 1 — Code (production-safe, do in order)

### Task 1 — Env helper module
- [ ] Create `src/lib/env.ts`:

```ts
export type AppEnv = "production" | "demo" | "staging";

export const APP_ENV: AppEnv =
  (process.env.NEXT_PUBLIC_APP_ENV as AppEnv | undefined) ?? "production";

export const isDemo = APP_ENV === "demo";
export const isStaging = APP_ENV === "staging";
export const isProduction = APP_ENV === "production";
```

- [ ] `npx tsc --noEmit` passes.
- [ ] Commit: `feat: add APP_ENV helper (NEXT_PUBLIC_APP_ENV)`.
- **Safe because:** new file; default is `production`.

### Task 2 — DemoBanner component
- [ ] Create `src/components/DemoBanner.tsx`:

```tsx
import { isDemo } from "@/lib/env";

export default function DemoBanner() {
  if (!isDemo) return null;
  return (
    <div
      role="region"
      aria-label="Demo environment notice"
      className="w-full bg-amber-100 dark:bg-amber-950/40 border-b border-amber-300/60 dark:border-amber-800/40 text-amber-900 dark:text-amber-200"
    >
      <div className="max-w-5xl mx-auto px-4 py-2 text-center text-sm font-medium">
        <span className="font-bold">Demo Environment</span> — This site contains
        fictional data for demonstration purposes. Changes may be reset
        automatically.
      </div>
    </div>
  );
}
```

- [ ] Create `src/__tests__/components/demo-banner.test.tsx`:

```tsx
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import DemoBanner from "@/components/DemoBanner";

jest.mock("@/lib/env", () => ({ isDemo: true, __esModule: true }));
it("renders the demo notice when isDemo", () => {
  render(<DemoBanner />);
  expect(screen.getByText(/fictional data/i)).toBeInTheDocument();
});
```

- [ ] Run `npm test -- demo-banner` → passes.
- [ ] Commit: `feat: add DemoBanner (demo-only, null in production)`.

### Task 3 — Wire banner into root layout  ← **demo banner milestone**
- [ ] Edit `src/app/layout.tsx`:
  - Add import: `import DemoBanner from "@/components/DemoBanner";`
  - Inside `<body className="min-h-screen">`, as the **first child** (above `<ThemeProvider>`): `<DemoBanner />`
- [ ] `npm run build` passes.
- [ ] Commit: `feat: render DemoBanner in root layout`.
- **Safe because:** `<DemoBanner />` returns `null` when `!isDemo`. Production build inlines `isDemo=false`, so nothing renders. Verify after deploy: production URL shows no banner.

### Task 4 — "Try Demo" login card
- [ ] Edit `src/app/login/page.tsx`, gated block above the glass card:

```tsx
{isDemo && (
  <div className="w-full max-w-md mb-4 ...">
    <p className="text-center text-sm font-semibold">Demo Environment</p>
    <p className="text-center text-xs text-slate-500">No registration required</p>
    <Button onClick={handleDemoLogin} disabled={demoLoading} className="w-full mt-3">
      {demoLoading ? "Starting demo…" : "Try Demo"}
    </Button>
    {demoError && <p className="text-red-500 text-xs text-center mt-2">{demoError}</p>}
  </div>
)}
```

- [ ] Add handler (calls the round-robin RPC from Task 5, then signs in):

```tsx
async function handleDemoLogin() {
  setDemoLoading(true);
  setDemoError(null);
  const supabase = createClient();
  const { data, error } = await supabase.rpc("claim_demo_account");
  const phone = (data as unknown as string) ?? null;
  if (error || !phone) {
    setDemoError("Demo unavailable. Try the manual login below.");
    setDemoLoading(false);
    return;
  }
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: `${phone}@church.local`,
    password: "demo123",
  });
  if (authError) {
    setDemoError("Demo unavailable. Try the manual login below.");
    setDemoLoading(false);
    return;
  }
  router.push("/trips");
}
```

- [ ] Add state: `const [demoLoading, setDemoLoading] = useState(false);` + `demoError`.
- [ ] Import `isDemo` from `@/lib/env`.
- [ ] `npm run lint && npm run build` pass.
- [ ] Commit: `feat: add Try Demo button (demo env only)`.
- **Safe because:** entire block is behind `{isDemo && …}`. Production renders nothing. Handler only runs in demo build.

### Task 5 — Demo pool migration + claim RPC
- [ ] Create `supabase/migrations/00010_demo_pool.sql`:

```sql
-- Demo account pool + round-robin claim. Harmless in prod (empty table).
CREATE TABLE IF NOT EXISTS public.demo_account_pool (
  phone text PRIMARY KEY,
  last_assigned_at timestamptz
);
ALTER TABLE public.demo_account_pool ENABLE ROW LEVEL SECURITY;
-- No RLS policies => table invisible to direct queries.
-- All access goes through the SECURITY DEFINER function below.

CREATE OR REPLACE FUNCTION public.claim_demo_account()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_phone text;
BEGIN
  SELECT phone INTO v_phone
  FROM public.demo_account_pool
  ORDER BY last_assigned_at NULLS FIRST, phone
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_phone IS NULL THEN
    RAISE EXCEPTION 'No demo accounts available';
  END IF;

  UPDATE public.demo_account_pool
  SET last_assigned_at = now()
  WHERE phone = v_phone;

  RETURN v_phone;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_demo_account() TO anon, authenticated;
```

- [ ] Run on the **demo** Supabase project only (via SQL Editor).
- **Safe because:** migration is additive; never run on prod. The RPC returns only phones that exist in `demo_account_pool`, which only the demo seed fills.
- **Why round-robin:** random pick from 100 still collides (birthday paradox). `ORDER BY last_assigned_at ... SKIP LOCKED` cycles through accounts → first 100 concurrent visitors get distinct accounts.

### Task 6 — Seed data (`supabase/seed-demo-data.sql`)
- [ ] Create idempotent seed (`ON CONFLICT DO NOTHING`) with:
  - **100 fake users**: phones `09900010001`–`09900010100`, balanced gender, ~8 wheelchair, varied sectors; `crypt('demo123', gen_salt('bf'))` for auth.users; matching `profiles` rows.
  - **2 open trips**: titles prefixed `[DEMO]` (bilingual), future dates.
  - **~8 buses**: across areas, capacity ~45, leader names, `trip_id` → demo trips.
  - **~10 rooms**: 5 male / 5 female, capacity, supervisor, `trip_id` → demo trips.
  - **~40 bookings**: demo users → demo trips + buses; ~15 with rooms assigned.
  - **Populate `demo_account_pool`**: `INSERT INTO demo_account_pool(phone) SELECT phone FROM profiles WHERE phone LIKE '099%';`
- [ ] Must self-contain any required sectors/areas (idempotent inserts) so it runs on a fresh demo DB.
- [ ] Run on **demo** project only; confirm trips page + admin dashboard look alive.
- [ ] Commit: `feat: add demo data seed script`.

### Task 7 — Cleanup (`supabase/cleanup-demo-data.sql`)
- [ ] Create idempotent teardown, FK-safe order:

```sql
BEGIN;
DELETE FROM public.bookings
WHERE user_id IN (SELECT id FROM public.profiles WHERE phone LIKE '099%')
   OR trip_id IN (SELECT id FROM public.trips WHERE title_en LIKE '[DEMO]%');
DELETE FROM public.trips WHERE title_en LIKE '[DEMO]%';   -- cascades buses, rooms
DELETE FROM public.profiles WHERE phone LIKE '099%';
DELETE FROM auth.users WHERE email LIKE '099%@church.local';
DELETE FROM public.family_members
WHERE head_id IN (SELECT id FROM public.profiles WHERE phone LIKE '099%');  -- if 00101 applied
TRUNCATE public.demo_account_pool;
COMMIT;
```

- [ ] Run on **demo** only.
- [ ] Commit: `feat: add demo cleanup script (replaces cleanup-demo-users.sql)`.

### Task 8 — Nightly reset action
- [ ] Create `.github/workflows/demo-reset.yml`: cron `0 3 * * *` UTC + `workflow_dispatch`; uses Node scripts (`scripts/cleanup-demo-data.mjs` + `scripts/seed-demo-data.mjs`) via `npm ci` + `node`.
- [ ] Add repo secrets `SUPABASE_DEMO_URL` (https URL) + `SUPABASE_DEMO_SERVICE_ROLE_KEY` (demo project's secret key).
- [ ] Commit: `ci: nightly demo data reset`.

### Task 9 — README section
- [ ] Add short "Live demo" section documenting prod vs demo + how to reset.
- [ ] Commit: `docs: document demo environment`.

---

## Phase 2 — Manual setup (you, in dashboards)

- [ ] Create Supabase project `booking-trip-demo` (free tier — you have 2 slots).
- [ ] **SQL Editor → run `supabase/schema.sql`** (one consolidated file; replaces all individual migrations; idempotent; final state only). If you previously started running migrations and hit errors, **delete the project and create a fresh one** — `schema.sql` assumes a clean DB.
- [ ] **Authentication → Providers → Email:** enable the provider, then turn OFF "Confirm email" (private app). Do NOT disable the Email provider itself — that breaks all sign-in.
- [ ] At repo root, create `.env.demo.local` (gitignored — never commit):
  ```
  NEXT_PUBLIC_SUPABASE_URL=https://YOUR-DEMO-PROJECT.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx
  ```
- [ ] **Run `npm run cleanup:demo`** (clears any half-seeded state), then **`npm run seed:demo`** → should print "✅ Demo seed complete." (Creates 100 users via Supabase admin API so `auth.identities` is populated correctly.)
- [ ] Create 2nd Vercel project (same repo, Production branch `main`).
- [ ] Set its env vars: `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (demo project) + `NEXT_PUBLIC_APP_ENV=demo`.
- [ ] Add GitHub repo secrets `SUPABASE_DEMO_URL` + `SUPABASE_DEMO_SERVICE_ROLE_KEY`.
- [ ] Production Vercel project: set `NEXT_PUBLIC_APP_ENV=production` (so it's explicit).

---

## Phase 3 — Go-live sign-off

- [ ] Production URL: **no banner**, no "Try Demo" button.
- [ ] Demo URL: banner shows, "Try Demo" present.
- [ ] Click "Try Demo" → logs into a random fake patient → lands on `/trips`.
- [ ] Open 2 incognito tabs → "Try Demo" in each → **different** accounts (round-robin works).
- [ ] `/admin` is **not** reachable from the demo patient (middleware + RLS).
- [ ] Manually trigger `demo-reset.yml` → demo data is fresh again.
- [ ] LinkedIn post uses the **demo URL**, never an admin login.

---

## Production safety — why main code can't break

1. Every UI change is behind `isDemo`, which is `false` in the production build.
2. No existing production logic is rewritten — only gated additions.
3. Migrations/seed/cleanup run on the demo DB only; never applied to prod.
4. The nightly action only knows the demo DB URL.
5. Default-on-misconfig is "demo invisible" (fail-closed), not "demo leaks into prod."

---

## Known gotchas

- **PDF report button** may error in demo (edge function not deployed there). Option: leave it (shows a graceful error) or hide it when `isDemo`. Decide later.
- **Supabase auth rate limits** on a traffic spike: each new visitor = one `signIn`. Fine for typical LinkedIn reach; not a concern for hundreds.
- **100-account ceiling**: beyond 100 concurrent NEW visitors, accounts start reusing. Acceptable; nightly reset clears state.
- **`family_members`** (migration `00101`): cleanup deletes demo heads; confirm column names match before running.

---

## Open decisions (confirm before Task 6)

1. **Demo user count:** 100? (default)
2. **Banner:** persistent (always visible) or dismissible per-session? (default: persistent — clearest)
