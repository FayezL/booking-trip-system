# CTRMS — Church Trip & Room Management System

Bilingual (Arabic/English) web app for managing church trips, bus bookings, and room assignments. Built for ~40 concurrent users with elderly-friendly UI.

## Quick Start

### 1. Clone & Install

```bash
git clone <repo-url>
cd booking0trip-system
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Copy your project URL and anon key from **Settings > API**
3. Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Run Database Migrations

Go to **SQL Editor** in your Supabase dashboard and run each migration file in order:

```bash
supabase/migrations/00001_create_profiles.sql
supabase/migrations/00002_create_trips.sql
supabase/migrations/00003_create_buses.sql
supabase/migrations/00004_create_rooms.sql
supabase/migrations/00005_create_bookings.sql
supabase/migrations/00006_auth_trigger.sql
supabase/migrations/00007_enable_rls.sql
supabase/migrations/00008_create_rpc_functions.sql
supabase/migrations/00009_servant_insert_profiles.sql
```

### 4. Create First Servant Account

In Supabase **SQL Editor**, run:

```sql
SELECT public.register_and_book(
  '01000000000',
  'Admin Servant',
  'Male',
  'changeme123',
  NULL, NULL
);

UPDATE public.profiles SET role = 'servant' WHERE phone = '01000000000';
```

Login with phone `01000000000` and password `changeme123`.

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deployment (Vercel)

### 1. Push to GitHub

```bash
git remote add origin <your-github-repo>
git push -u origin main
```

### 2. Deploy on Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repo
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key
4. Click **Deploy**

### 3. Configure Supabase Auth

In Supabase dashboard:
- **Authentication > URL Configuration**: Add your Vercel URL to **Site URL** and **Redirect URLs**
- **Authentication > Email**: Disable **Confirm email** (this is a private app)

### 4. Deploy Edge Function (PDF Reports)

```bash
npx supabase functions deploy generate-report
```

Set the function secret:
```bash
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run test suite (103 tests) |

## Tech Stack

- **Frontend:** Next.js 14 App Router, React 18, TypeScript, Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Auth, Edge Functions)
- **PDF:** pdf-lib (client-side + Edge Function)
- **Testing:** Jest + React Testing Library

## Project Structure

```
src/
  app/
    login/              # Phone + password login
    signup/             # Registration
    (authenticated)/
      trips/            # Patient: browse & book trips
      admin/            # Servant: dashboard, CRUD, reports
  components/           # Shared UI components
  lib/
    supabase/           # Client, server, middleware
    i18n/               # AR/EN dictionaries + context
    types/              # TypeScript interfaces
supabase/
  migrations/           # DB schema + RLS + RPC functions
  functions/            # Edge Functions (PDF reports)
```
