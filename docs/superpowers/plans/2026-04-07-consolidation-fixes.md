# Consolidation & Bug Fixes — Execution Plan

> **Date:** 2026-04-07
> **Status:** EXECUTED

## Summary

Consolidated 11 messy migrations into 1 clean file, fixed trip deletion bug, fixed is_servant() confusion, added passenger names to trips pages, wrote complete system documentation.

## What Was Done

- [x] Wrote `docs/superpowers/SYSTEM.md` — single source of truth for the entire system
- [x] Wrote `supabase/migrations/00001_initial_schema.sql` — consolidated migration
- [x] Deleted 11 old migration files
- [x] Added passenger names to patient trips page (`/trips`)
- [x] Added booked count badge to admin trips list (`/admin/trips`)
- [x] Added `showLess` i18n keys (AR + EN)
- [x] Build + lint pass
- [x] Deleted 15 old plan/spec files

## Bugs Fixed

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| Cannot delete trips | `bookings.trip_id` FK had no ON DELETE CASCADE | Added `ON DELETE CASCADE` |
| `is_servant()` broken | It just called `is_admin()` confusingly | Removed `is_servant()`, all policies use `is_admin()` |
| Duplicate functions | Defined 2-3 times across 11 files | Single migration file |
| No passenger names | Patient trips page had no names | Added passenger list via `get_trip_passengers` RPC |
| No booking count in admin | Admin trips list had no stats per trip | Added booking count badge |

## Manual Steps Required in Supabase

See section below.
