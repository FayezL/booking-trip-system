# Saint Demiana — Trip & Room Management System

A bilingual (Arabic/English) web application for managing church trips, bus bookings, room assignments, and car pooling. Designed for ~40 concurrent users with an elderly-friendly, mobile-first UI featuring large touch targets, high-contrast colors, and RTL (right-to-left) Arabic support.

## Features

### For Patients & Members
- **Browse & Book Trips** — View upcoming trips, see available buses by area, and book a seat
- **Bus Seat Selection** — Choose a specific bus grouped by area with leader name and capacity info
- **Car Pooling** — Members with cars can offer rides; others can join cars with available seats
- **Settings** — Update sector affiliation, car availability, and seat count
- **Arabic / English Toggle** — Switch languages at any time; full RTL support for Arabic

### For Servants & Admins
- **Admin Dashboard** — At-a-glance stats per trip: registered count, booked/unbooked, bus seats filled, rooms assigned
- **Trip Management** — Create, edit, open/close, and delete trips
- **Bus Management** — Add buses per trip with area, capacity, leader name, and batch-create up to 20 buses at once
- **Room Management** — Create male/female rooms with capacity and supervisor; assign patients to rooms
- **Car Management** — Track member-owned cars, assign drivers, manage seat capacity
- **User Management** — Create/edit users with roles, gender, wheelchair flag, sector, and password reset
- **Sector Management** — Organize members into sectors with sort ordering and active/inactive status
- **PDF Reports** — Generate downloadable bus and room rosters (bilingual) via Supabase Edge Function
- **Audit Logs** — Track all admin actions (login, CRUD operations, bookings, role changes) with pagination and filtering

### User Roles

| Role | Access |
|------|--------|
| `super_admin` | Full system access |
| `admin` | All admin features |
| `servant` | Admin dashboard, user/trip/bus/room management |
| `patient` | Browse trips, book buses, update own settings |
| `companion` | Same as patient |
| `family_assistant` | Same as patient |

### UI & Accessibility
- **Dark Mode** — System-aware with manual toggle
- **Mobile-First** — Responsive sidebar, bottom navigation on mobile, 48px minimum touch targets
- **Elderly-Friendly** — 18px base font size, large buttons, high contrast, numeric-only phone input
- **Toast Notifications** — Inline feedback for all actions
- **Animated Transitions** — Fade-in, slide-up, slide-down animations

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Auth & Database | Supabase (PostgreSQL, Auth, RLS, Edge Functions) |
| PDF Generation | pdf-lib + @pdf-lib/fontkit |
| Analytics | Vercel Analytics |
| Testing | Jest + React Testing Library |
| Deployment | Vercel |

## Quick Start

### Prerequisites
- Node.js 18+
- npm
- A [Supabase](https://supabase.com) account

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

Go to **SQL Editor** in your Supabase dashboard and run each file in order:

```
supabase/migrations/00001_initial_schema.sql
supabase/migrations/00002_fix_cascade_and_policies.sql
supabase/migrations/00003_add_rpc_functions.sql
supabase/migrations/00004_add_sectors.sql
supabase/migrations/00004_part1_infrastructure.sql
supabase/migrations/00004_part2_functions.sql
supabase/migrations/00006_part1_cars_schema.sql
supabase/migrations/00006_part2_cars_functions.sql
supabase/migrations/00007_hard_delete_user.sql
supabase/migrations/00008_fix_user_delete_cascade.sql
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
| `npm test` | Run test suite |
| `npm run test:watch` | Run tests in watch mode |

## Project Structure

```
src/
  app/
    login/                      # Phone + password login
    signup/                     # Registration (patient/servant)
    (authenticated)/
      trips/                    # Browse trips & book buses
        [tripId]/buses/         # Bus listing for a specific trip
      settings/                 # User settings (sector, car)
      admin/
        page.tsx                # Dashboard with trip stats
        trips/[id]/             # Trip detail (overview, buses, rooms, cars, unbooked)
        users/                  # User CRUD + role management
        sectors/                # Sector CRUD
        reports/                # PDF report generation
        logs/                   # Audit log viewer
      layout.tsx                # Authenticated layout with sidebar
  components/
    Header.tsx                  # App header with language & theme toggles
    MobileNav.tsx               # Bottom navigation for mobile
    LanguageToggle.tsx          # AR/EN switch
    ThemeToggle.tsx             # Light/dark mode toggle
    Toast.tsx                   # Toast notification provider
    LoadingSpinner.tsx          # Loading state component
  lib/
    supabase/
      client.ts                 # Browser Supabase client
      server.ts                 # Server-side Supabase client
      middleware.ts             # Session refresh middleware
    i18n/
      context.tsx               # I18n React context
      useTranslation.ts         # Translation hook
      dictionaries/
        ar.json                 # Arabic translations
        en.json                 # English translations
    types/
      database.ts               # TypeScript types (Profile, Trip, Bus, Room, Car, Booking, AdminLog, Sector)
    pdf/
      generate-report.ts        # Client-side PDF generation
    admin-logs.ts                # Admin action logging utility
    constants.ts                 # App-wide constants
  middleware.ts                  # Auth middleware (session refresh)
  __tests__/
    components/                 # Component tests (login, signup, loading-spinner)
    lib/                        # Library tests (i18n)
    security/                   # Security audit tests
supabase/
  migrations/                   # Database schema, RLS policies, RPC functions
  functions/
    generate-report/            # Edge Function for server-side PDF generation
```

## Database Schema

The app uses PostgreSQL via Supabase with Row Level Security (RLS) on all tables:

- **profiles** — User info: phone, name, gender, role, wheelchair, sector, car
- **trips** — Trip events with bilingual titles and open/close status
- **buses** — Buses per trip with area, capacity, and leader
- **rooms** — Male/female rooms with capacity and supervisor
- **cars** — Member-owned cars with driver and seat count
- **bookings** — Links a user to a trip + bus/room/car assignment
- **sectors** — Organizational groups for members
- **admin_logs** — Audit trail of all admin actions

## License

Private — All rights reserved.
