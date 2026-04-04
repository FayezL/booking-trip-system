# Dark Mode Design Spec

## Summary

Add a dark mode theme to the Booking0Trip system using `next-themes` and Tailwind CSS `dark:` class variants. Users toggle manually via a sun/moon icon button in the header. Preference is persisted in localStorage with no flash of wrong theme on load.

## Architecture

- **Dependency:** `next-themes`
- **Tailwind config:** Add `darkMode: 'class'` to toggle dark mode via `dark` class on `<html>`
- **Root layout:** Wrap app in `next-themes` `ThemeProvider` with `attribute="class"` and `defaultTheme="light"`
- **New component:** `src/components/ThemeToggle.tsx` — sun/moon icon button using `useTheme()` hook
- **Theme persistence:** Handled automatically by `next-themes` via localStorage; applies before paint
- **Scope:** All pages including login and signup

## Color Mapping

Neutral dark grays with blue accents preserved.

| Element | Light | Dark |
|---|---|---|
| Body background | `bg-slate-50` | `dark:bg-gray-950` |
| Cards / panels | `bg-white` | `dark:bg-gray-900` |
| Primary text | `text-slate-800` | `dark:text-gray-100` |
| Secondary text | `text-slate-500/600` | `dark:text-gray-400` |
| Muted text | `text-slate-400` | `dark:text-gray-500` |
| Borders | `border-slate-100/200` | `dark:border-gray-800` |
| Header/nav bg | `bg-white/95` | `dark:bg-gray-900/95` |
| Input fields | `bg-white border-slate-200` | `dark:bg-gray-800 dark:border-gray-700` |
| Input placeholder | `placeholder:text-slate-300` | `dark:placeholder:text-gray-500` |
| Secondary button | `bg-slate-100 text-slate-700` | `dark:bg-gray-800 dark:text-gray-200` |
| Hover states | `hover:bg-slate-50/100` | `dark:hover:bg-gray-800/700` |
| Login gradient | `from-blue-50 via-white to-slate-50` | `dark:from-gray-950 dark:via-gray-900 dark:to-gray-950` |
| Blue accents | `text-blue-600/700` | Kept same |
| Error backgrounds | `bg-red-50 text-red-600` | `dark:bg-red-950/50 dark:text-red-400` |
| Badge blue | `bg-blue-50 text-blue-700` | `dark:bg-blue-950/30 dark:text-blue-400` |
| Badge green | `bg-emerald-50 text-emerald-700` | `dark:bg-emerald-950/30 dark:text-emerald-400` |
| Badge red | `bg-red-50 text-red-700` | `dark:bg-red-950/30 dark:text-red-400` |
| Badge amber | `bg-amber-50 text-amber-700` | `dark:bg-amber-950/30 dark:text-amber-400` |
| Active nav | `bg-blue-50 text-blue-700` | `dark:bg-blue-950/50 dark:text-blue-400` |
| Scrollbars | `bg-slate-200` | `dark:bg-gray-700` |
| Progress bar bg | `bg-slate-100` | `dark:bg-gray-800` |
| Gender buttons (inactive) | `border-slate-200 bg-white` | `dark:border-gray-700 dark:bg-gray-800` |

Blue-600 primary buttons and their shadows get subtle dark-mode adjustments (`dark:shadow-blue-400/10`). Progress bar gradient fills remain the same.

## ThemeToggle Component

- Sun icon (shown in light mode) / Moon icon (shown in dark mode)
- Inline SVG, no icon library needed
- Matches the existing `LanguageToggle` button style: `p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800`
- Uses `useTheme()` from `next-themes`
- Mounted guard to avoid hydration mismatch

## Files to Modify (23 files)

1. `tailwind.config.ts` — add `darkMode: 'class'`
2. `src/app/layout.tsx` — add `ThemeProvider` wrapper
3. `src/app/globals.css` — add `dark:` variants to all component classes
4. `src/components/ThemeToggle.tsx` — **new file**
5. `src/components/Header.tsx` — dark styles + import ThemeToggle
6. `src/components/MobileNav.tsx` — dark styles
7. `src/components/LanguageToggle.tsx` — dark styles
8. `src/components/LoadingSpinner.tsx` — dark styles
9. `src/components/Toast.tsx` — dark styles
10. `src/app/login/page.tsx` — dark styles + add ThemeToggle
11. `src/app/signup/page.tsx` — dark styles + add ThemeToggle
12. `src/app/(authenticated)/admin/page.tsx` — dark styles
13. `src/app/(authenticated)/admin/trips/page.tsx` — dark styles
14. `src/app/(authenticated)/admin/trips/[id]/page.tsx` — dark styles
15. `src/app/(authenticated)/admin/trips/[id]/OverviewTab.tsx` — dark styles
16. `src/app/(authenticated)/admin/trips/[id]/BusesTab.tsx` — dark styles
17. `src/app/(authenticated)/admin/trips/[id]/RoomsTab.tsx` — dark styles
18. `src/app/(authenticated)/admin/trips/[id]/UnbookedTab.tsx` — dark styles
19. `src/app/(authenticated)/admin/users/page.tsx` — dark styles
20. `src/app/(authenticated)/admin/logs/page.tsx` — dark styles
21. `src/app/(authenticated)/admin/reports/page.tsx` — dark styles
22. `src/app/(authenticated)/trips/page.tsx` — dark styles
23. `src/app/(authenticated)/trips/[tripId]/buses/page.tsx` — dark styles

## Out of Scope

- System preference auto-detection
- Settings page for theme
- Theme options beyond light/dark
- Data model or API changes
- Any functional behavior changes
