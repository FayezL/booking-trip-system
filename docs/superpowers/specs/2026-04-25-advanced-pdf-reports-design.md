# Design: Advanced PDF Reports

> Date: 2026-04-25
> Status: Approved

## Problem

Current PDF reports are basic (plain text, no formatting, missing most data). They only show bus and room lists with passenger names/phones/gender. Missing: family members, sectors, wheelchair tracking, car passengers, transport breakdown, unassigned passengers, trip-level summary.

## Solution

Replace the existing bus/room reports with **one comprehensive trip report PDF** that contains all possible data for a selected trip, organized into 6 professionally-formatted sections.

## Report Structure

### Section 1 — Cover/Summary Page
- Trip name (Arabic), date, open/closed badge
- Key stats in colored boxes: Total Booked, Total Registered, Family Members, Wheelchair Users
- Tables:
  - Role breakdown (role, count, %)
  - Gender breakdown (Male/Female counts + wheelchair per gender)
  - Transport breakdown (on bus / in car / no transport)
  - Servants needed (0/1/2 counts)
  - Sector breakdown (sector name, count)

### Section 2 — All Buses
- Grouped by area with area headers
- Per bus: label, leader, area, capacity fill-rate bar, fill count, wheelchair count
- Passenger table: #, Name, Phone, Gender, Role, Sector, wheelchair marker
- Family members indented under their head with prefix marker

### Section 3 — All Cars
- Per car: driver name, label, capacity, passenger count
- Passenger table: #, Name, Phone, Gender, Role, Sector, wheelchair marker

### Section 4 — All Rooms
- Per room: label, type, supervisor, capacity fill-rate bar, fill count, wheelchair count
- Occupant table: #, Name, Phone, Gender, Role, Sector, wheelchair marker

### Section 5 — Wheelchair Users
- Complete table of ALL wheelchair users across the trip
- Columns: Name, Phone, Gender, Sector, Bus, Room, Car

### Section 6 — Unassigned Passengers
- Sub-sections: No Bus, No Room, No Transport
- Table per sub-section: #, Name, Phone, Gender, Role, Sector, wheelchair marker

## PDF Formatting

- **Page size**: A4 (595.28 x 841.89)
- **Text direction**: Right-to-left (Arabic)
- **Font**: NotoNaskhArabic-Regular.ttf (already in /public/fonts/)
- **Repeating header**: Trip title + date + report section name + page number on every page
- **Section headers**: Blue background (#1a56db) with white text, full-width
- **Tables**: Grid lines, alternating white/light-gray rows
- **Fill-rate bars**: Horizontal colored bars (green < 70%, yellow < 90%, red >= 90%)
- **Wheelchair marker**: Text indicator next to wheelchair user names
- **Family member prefix**: Indented with arrow prefix under head
- **Margins**: 50pt right, 40pt left, 50pt top (below header), 50pt bottom

## Architecture

- **Client-side only** using pdf-lib + @pdf-lib/fontkit (keep existing working approach)
- **Data fetching**: Reports page fetches all data from Supabase, passes to generator
- **New shared drawing utilities** in generate-report.ts:
  - `drawPageHeader()` — repeating header on every page
  - `drawSectionHeader()` — blue section headers
  - `drawTable()` — generic table renderer with columns, alternating rows
  - `drawStatBox()` — colored number boxes for summary
  - `drawFillBar()` — horizontal fill-rate bar
- **Edge Function**: Keep but do NOT update (currently unused, not worth the effort)

## Reports Page UI Changes

- Replace 2 buttons (Bus/Room) with single "Generate Trip Report" button
- Trip dropdown stays the same
- Show loading progress while generating
- Download as `trip-report-{trip-title-ar}.pdf`

## Data Queries

The reports page will fetch:
1. `get_all_trips_stats()` — summary stats (reuse Phase 10 RPC)
2. `get_trip_passengers(trip_id)` — complete passenger list with sector + gender
3. Buses with passengers (bookings with profiles + family_members)
4. Rooms with occupants (bookings with profiles + family_members)
5. Cars with passengers (bookings with profiles)
6. Unassigned passengers (bookings where bus_id IS NULL, room_id IS NULL, or both)

All family member data included via LEFT JOIN on family_members table.

## i18n Keys Needed

~15 new keys per language for:
- Report button label
- Section names (Summary, Buses, Cars, Rooms, Wheelchair Users, Unassigned)
- Table headers (Name, Phone, Gender, Role, Sector, Bus, Room, Car, #, Fill Rate, Wheelchair)
- Stat labels
- No data messages
