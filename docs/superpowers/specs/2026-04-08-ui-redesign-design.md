# UI Redesign Design Spec — Booking0Trip

> Full redesign of the frontend UI: modern clean style with shadcn/ui
> Date: 2026-04-08

---

## Goal

Transform the current hand-rolled Tailwind UI into a polished, professional, accessible interface using shadcn/ui components — while keeping all existing functionality intact. The app must remain elderly-friendly (large touch targets, clear Arabic text) and bilingual (Arabic/English, RTL-first).

## Design System

### Component Library

**shadcn/ui** — copy-paste components built on Radix UI primitives + Tailwind CSS. Accessible by default, fully customizable, no external runtime dependency.

**Installation approach:**
```
npx shadcn@latest init
npx shadcn@latest add button card input label dialog alert-dialog
npx shadcn@latest add badge tabs table select separator dropdown-menu
npx shadcn@latest add sheet skeleton progress command breadcrumb
npx shadcn@latest add toast avatar tooltip scroll-area popover
```

### Icon Library

**Lucide React** — installed automatically with shadcn. Consistent line icons, tree-shakeable, used throughout instead of inline SVGs.

```
npm install lucide-react
```

### Typography

**Font stack:**
- Primary: **IBM Plex Sans Arabic** (Google Font) — excellent Arabic readability, clean, modern, supports both AR and EN
- Fallback: `system-ui, sans-serif`

Loaded via `next/font/google` in root layout.

### Color System

Keep blue as primary. Define CSS custom properties via shadcn theming (HSL values in `globals.css`):

```
Primary:    Blue-600 range   (actions, buttons, links)
Secondary:  Slate range       (secondary buttons, muted elements)
Accent:     Blue-100 range   (highlights, hover states)
Destructive: Red range       (delete, cancel, danger actions)
Background: White / Gray-950  (light / dark mode)
Foreground: Slate-900 / Gray-50
Muted:      Slate-100 / Gray-800
Border:     Slate-200 / Gray-700
```

Dark mode continues via `next-themes` class strategy. shadcn's CSS variable approach handles both modes automatically.

### Spacing & Sizing

- Base font: 16px (reduced from 18px — IBM Plex Sans Arabic renders larger)
- Min touch target: 44px (shadcn default for buttons/inputs)
- Card padding: `p-6` (24px)
- Card radius: `rounded-lg` (8px, shadcn default — less rounded than current `rounded-2xl`)
- Page container: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`

### Animations

- Transitions: 150-200ms ease
- Page entries: subtle fade-in only (no slide-up, no bounce)
- `prefers-reduced-motion`: disable all animations

---

## Layout Architecture

### Root Layout (unchanged structure)

- `lang="ar" dir="rtl"` on `<html>`
- ThemeProvider + I18nProvider + ToastProvider (shadcn Sonner replaces custom Toast)
- `min-h-screen` on body

### Authenticated Layout — Admin

**Desktop:** Sidebar navigation on the right side (RTL) + top breadcrumb bar
**Mobile:** Bottom tab bar (refined)

**Sidebar structure:**
```
┌─────────────────────────────────┬──────────────┐
│  Breadcrumbs: Dashboard > Trips │   Sidebar    │
│─────────────────────────────────│              │
│                                 │  Dashboard   │
│   Page Content                  │  Trips       │
│   (max-w-7xl)                   │  My Bookings │
│                                 │  Reports     │
│                                 │  Users       │
│                                 │  Logs        │
│                                 │              │
│                                 │  ─────────   │
│                                 │  [Avatar]    │
│                                 │  Name        │
│                                 │  Logout      │
└─────────────────────────────────┴──────────────┘
```

- Sidebar width: `w-64` (256px)
- Collapsible on smaller screens via Sheet component
- Active item: blue text + blue left border
- Bottom section: user avatar + name + logout

### Authenticated Layout — Patient

**Desktop:** Clean top header + content area (no sidebar needed — few nav items)
**Mobile:** Bottom tab bar

**Header structure:**
```
┌──────────────────────────────────────────────┐
│  [Logo] Verena Church     [AR/EN] [☀/🌙] [👤]│
│──────────────────────────────────────────────│
│  Breadcrumbs: Trips > Bus Selection           │
└──────────────────────────────────────────────┘
```

- Profile dropdown on avatar click: view name, role, logout
- Language + theme toggles in header

### Mobile Navigation (both roles)

- Fixed bottom tab bar with shadcn styling
- Frosted glass: `bg-background/80 backdrop-blur-lg border-t`
- Tabs: icon + label, active = primary color
- Admin: Dashboard, Trips, Bookings, Reports, Users, Logs (scrollable)
- Patient: show the bar with "Trips" tab (even as single item — provides visual consistency and future-proofing)

---

## Page-by-Page Design

### Login Page (`/login`)

**Components:** Card, Input, Label, Button, Checkbox

- Centered card on subtle gradient background (`from-blue-50 via-background to-blue-50`)
- Church cross icon (Lucide `Church`) in primary-colored circle
- "Login" title + subtitle
- Phone input (tel type, `dir="ltr"`, with `Phone` icon)
- Password input (with show/hide toggle via `Eye`/`EyeOff` icons)
- Remember me checkbox
- Full-width primary button
- "Don't have an account? Sign up" link
- Language + theme toggles in top corner

### Signup Page (`/signup`)

**Components:** Card, Input, Label, Button, Select, Switch, Separator

- Same layout structure as login
- Fields: Phone, Full Name, Gender (shadcn Select), User Type (shadcn Select or radio group), Wheelchair (shadcn Switch), Password
- Each field has proper label and validation message area
- Link to login at bottom

### Patient Trips List (`/trips`)

**Components:** Card, Badge, Button, Skeleton, Breadcrumb

- Breadcrumb: `الرئيسية` (Home)
- Page title: "Available Trips"
- Each trip as a card with:
  - Trip title (large, bold)
  - Date with `Calendar` icon
  - Passenger count with `Users` icon
  - "Book Now" button (primary) or green "Booked" badge
  - Expandable passenger list with `ChevronDown` toggle
- "My Bookings" section below with separator
- Empty state: `CalendarX` icon + message
- Loading: skeleton cards matching trip card shape

### Bus Selection (`/trips/[tripId]/buses`)

**Components:** Card, Button, Badge, Progress, Dialog, Skeleton, Breadcrumb

- Breadcrumb: `الرئيسية > Trip Name`
- Back button with `ArrowRight` icon (RTL)
- Buses grouped by area with area headers
- Each bus card:
  - Bus label + leader name with `User` icon
  - shadcn Progress bar for capacity (blue < 80%, amber 80-99%, red = full)
  - Seat count text: "12/50 seats"
  - "Book" button or "Full" badge
  - Expandable passenger list
- Booking confirmation: shadcn Dialog with checkmark, trip details table, "OK" button

### Admin Dashboard (`/admin`)

**Components:** Card, Skeleton, Breadcrumb, Avatar

- Breadcrumb: `لوحة التحكم` (Dashboard)
- Page title + subtitle
- Trip cards in responsive grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`)
- Each trip card is clickable:
  - Trip title + date
  - Stat grid inside: Total (blue), Booked (green), Unbooked (red), Bus Seats (purple)
  - Each stat: icon + number + label
  - Rooms assigned as separate row
- Hover: subtle shadow elevation + border color change
- Loading: skeleton grid

### Admin Trips (`/admin/trips`)

**Components:** Button, Dialog, Input, Label, Card, Badge, Switch, Breadcrumb, AlertDialog

- Breadcrumb: `لوحة التحكم > الرحلات`
- "+ Create Trip" button in header
- Create/Edit: shadcn Dialog modal with form fields (Title, Date, Open toggle)
- Trip list: cards with title, date, booking count badge, action buttons
- Actions: Manage (link), Open/Closed (Switch), Edit (Dialog), Delete (AlertDialog confirmation)

### Admin Trip Detail (`/admin/trips/[id]`)

**Components:** Tabs, Card, Button, Badge, Table, Dialog, AlertDialog, Progress, Select, Input, Breadcrumb, Separator, ScrollArea

- Breadcrumb: `لوحة التحكم > الرحلات > Trip Name`
- shadcn Tabs: Overview | Buses | Rooms | Unbooked

**OverviewTab:**
- Stat cards in grid (4-col desktop, 2-col mobile)
- Area overview with progress bars
- Quick action buttons

**BusesTab:**
- "+ Add Bus" button opens Dialog
- Bus list with collapsible passenger sections
- Each bus: label, leader, progress bar, capacity
- Passenger actions: "Move" (Dialog with bus select), "Remove" (AlertDialog)
- DataTable for passenger list within each bus

**RoomsTab:**
- Gender tabs (Boys/Girls)
- "+ Add Room" button opens Dialog
- Room filter: All / Available / Full (toggle buttons)
- Two-panel layout:
  - Left: Unassigned passengers list (searchable, with `Search` icon)
  - Right: Room cards with capacity, supervisor, assign button
- Click unassigned person → click "Assign" on room → assigns (same click-to-assign pattern as current, with improved visual feedback and a highlighted state on the selected person)

**UnbookedTab:**
- Search bar + gender filter
- User list with DataTable: name, phone, gender, role, actions
- "Book" action: Dialog with bus select dropdown
- "Register New" button: Dialog with registration form

### Admin Users (`/admin/users`)

**Components:** DataTable, Dialog, Input, Label, Select, Switch, Button, AlertDialog, Badge, Breadcrumb

- Breadcrumb: `لوحة التحكم > الأشخاص`
- "+ Add Person" button opens Dialog with form
- DataTable with columns: Name, Phone, Role, Gender, Wheelchair, Actions
- Sortable columns, search input, role filter (dropdown)
- Actions: Change Role (Dialog), Reset Password (Dialog), Delete (AlertDialog)
- Pagination at bottom
- Super admin rows: "Protected" badge, no action buttons

### Admin Logs (`/admin/logs`)

**Components:** DataTable, Select, Badge, Breadcrumb

- Breadcrumb: `لوحة التحكم > سجل الأنشطة`
- Action filter dropdown
- DataTable: timestamp, admin name, action (badge), target type, target ID
- Pagination
- Limited to 500 most recent

### Admin Reports (`/admin/reports`)

**Components:** Card, Select, Button, Skeleton, Breadcrumb

- Breadcrumb: `لوحة التحكم > التقارير`
- Trip selector (shadcn Select)
- Two buttons: "Bus Report" (with `Bus` icon), "Room Report" (with `BedDouble` icon)
- Loading skeleton during PDF generation
- Success toast when download starts

---

## Shared Components

### Header (Patient Desktop)
- Logo + brand name
- Language toggle (small pill)
- Theme toggle (sun/moon icon button)
- Profile dropdown (avatar + name): shows role, logout option

### Sidebar (Admin Desktop)
- Logo + brand at top
- Nav items with icons: Dashboard (`LayoutDashboard`), Trips (`Map`), My Bookings (`Ticket`), Reports (`FileText`), Users (`Users`), Logs (`ScrollText`)
- Active state: primary bg + white text or primary text + border
- Separator line
- User section at bottom: avatar circle with initials, name, role badge, logout

### MobileNav (Both Roles)
- shadcn-styled bottom tab bar
- Frosted glass background
- Icons from Lucide
- Active tab: primary color + filled icon variant

### Breadcrumb
- shadcn Breadcrumb component
- Shows path: `Dashboard > Trips > Trip Name > Buses`
- Clickable ancestors
- Current page: non-link, muted text
- RTL: separators point left (`<` instead of `>`)

### Toast (Sonner)
- Replace custom Toast with shadcn Sonner
- Positions: top-center (RTL)
- Types: success, error, info
- Auto-dismiss with progress bar
- Close button
- Stacking support

### Loading States
- Replace LoadingSpinner with shadcn Skeleton on every page
- Skeleton shapes match the content layout (cards, tables, forms)
- Skeleton pulses with `animate-pulse`

---

## File Structure Changes

```
src/
  app/
    globals.css                    # NEW: shadcn CSS variables + Tailwind
    layout.tsx                     # UPDATED: IBM Plex Sans Arabic font
    login/page.tsx                 # REBUILT: shadcn components
    signup/page.tsx                # REBUILT: shadcn components
    (authenticated)/
      layout.tsx                   # REBUILT: sidebar for admin, header for patient
      trips/
        page.tsx                   # REBUILT: shadcn cards, badges, skeletons
        [tripId]/buses/page.tsx    # REBUILT: shadcn cards, progress, dialog
      admin/
        page.tsx                   # REBUILT: shadcn cards, skeletons
        trips/
          page.tsx                 # REBUILT: shadcn dialog, cards, tabs
          [id]/
            page.tsx               # REBUILT: shadcn tabs
            OverviewTab.tsx        # REBUILT: shadcn cards, progress
            BusesTab.tsx           # REBUILT: shadcn dialog, alert-dialog, table
            RoomsTab.tsx           # REBUILT: shadcn dialog, select, scroll-area
            UnbookedTab.tsx        # REBUILT: shadcn dialog, table, input
        users/page.tsx             # REBUILT: shadcn data-table, dialog, alert-dialog
        logs/page.tsx              # REBUILT: shadcn data-table, select, badge
        reports/page.tsx           # REBUILT: shadcn select, button
  components/
    ui/                            # NEW: shadcn generated components
      button.tsx
      card.tsx
      input.tsx
      label.tsx
      dialog.tsx
      alert-dialog.tsx
      badge.tsx
      tabs.tsx
      table.tsx
      select.tsx
      separator.tsx
      dropdown-menu.tsx
      sheet.tsx
      skeleton.tsx
      progress.tsx
      command.tsx
      breadcrumb.tsx
      switch.tsx
      avatar.tsx
      tooltip.tsx
      scroll-area.tsx
      popover.tsx
      sonner.tsx
    Header.tsx                     # REBUILT: cleaner with profile dropdown
    MobileNav.tsx                  # REBUILT: shadcn styling, Lucide icons
    AdminSidebar.tsx               # NEW: admin desktop sidebar
    Breadcrumbs.tsx                # NEW: page breadcrumb wrapper
    LanguageToggle.tsx             # UPDATED: shadcn Button
    ThemeToggle.tsx                # UPDATED: shadcn Button + Lucide icons
    LoadingSpinner.tsx             # DEPRECATED: replace with Skeleton
    Toast.tsx                      # DEPRECATED: replace with Sonner
  lib/
    utils.ts                       # NEW: shadcn cn() utility (clsx + tailwind-merge)
    ... (rest unchanged)

components.json                    # NEW: shadcn/ui config
tailwind.config.ts                 # UPDATED: shadcn theme extensions
```

---

## New Dependencies

```json
{
  "@radix-ui/react-*": "managed by shadcn",
  "class-variance-authority": "CVA for component variants",
  "clsx": "classname utility",
  "tailwind-merge": "merge tailwind classes",
  "lucide-react": "icon library",
  "sonner": "toast notifications",
  "cmdk": "command palette (optional)"
}
```

All installed automatically via `npx shadcn@latest init` and component additions.

---

## What Does NOT Change

- All Supabase queries, auth, RLS, RPC functions
- i18n system (context + dictionaries)
- All business logic (booking, cancellation, room assignment, etc.)
- Database schema
- Middleware (auth redirects)
- PDF generation (Edge Function + pdf-lib)
- Role-based access control logic
- Admin logs

---

## Accessibility Requirements

- All interactive elements: visible focus rings (shadcn default)
- All forms: labels associated with inputs via `htmlFor`
- Error messages: `role="alert"` or `aria-live="polite"`
- Dialogs: trap focus, close on Escape, proper aria attributes (shadcn/Radix default)
- Tables: proper `<th>` headers, scope attributes
- Skip-to-content link at top of page
- `prefers-reduced-motion`: disable animations
- Min contrast ratio: 4.5:1 for text, 3:1 for large text

---

## Migration Strategy

Since this is a full redesign, pages are rebuilt one at a time. Each page replacement is self-contained:

1. Install shadcn/ui + configure theme + add all components
2. Add `cn()` utility + update Tailwind config
3. Update root layout (font, Sonner)
4. Rebuild auth pages (login, signup)
5. Rebuild authenticated layout (sidebar, header, breadcrumb, mobilenav)
6. Rebuild patient pages (trips list, bus selection)
7. Rebuild admin pages one by one (dashboard, trips, trip detail tabs, users, logs, reports)
8. Remove deprecated components (LoadingSpinner, old Toast)

Each step results in a working, testable state. No "big bang" deployment.
