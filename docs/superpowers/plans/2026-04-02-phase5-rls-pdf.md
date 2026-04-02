# Phase 5: RLS Policies, PDF Reports & Final Integration

> **Goal:** Lock down all tables with Row Level Security policies, add PDF report generation via Supabase Edge Function, and finalize routing.

**Architecture:** PostgreSQL RLS with helper function for servant role checks. Deno Edge Function using pdf-lib for PDF generation. All reports in Arabic/English.

**Tech Stack:** PostgreSQL RLS, Supabase Edge Functions (Deno), pdf-lib

---

### Task 29: RLS policies for all tables

**Files:**
- Create: `supabase/migrations/00008_create_rls_policies.sql`

- [ ] **Step 1: Write RLS policies migration**

```sql
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_servant()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'servant');
$$;

-- Profiles: users see own, servants see all, servants can insert/update
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Servants can view all profiles" ON public.profiles FOR SELECT USING (public.is_servant());
CREATE POLICY "Servants can insert profiles" ON public.profiles FOR INSERT WITH CHECK (public.is_servant());
CREATE POLICY "Servants can update profiles" ON public.profiles FOR UPDATE USING (public.is_servant());

-- Trips: everyone reads, servants manage
CREATE POLICY "Anyone can view open trips" ON public.trips FOR SELECT USING (true);
CREATE POLICY "Servants can insert trips" ON public.trips FOR INSERT WITH CHECK (public.is_servant());
CREATE POLICY "Servants can update trips" ON public.trips FOR UPDATE USING (public.is_servant());
CREATE POLICY "Servants can delete trips" ON public.trips FOR DELETE USING (public.is_servant());

-- Buses: everyone reads, servants manage
CREATE POLICY "Anyone can view buses" ON public.buses FOR SELECT USING (true);
CREATE POLICY "Servants can insert buses" ON public.buses FOR INSERT WITH CHECK (public.is_servant());
CREATE POLICY "Servants can update buses" ON public.buses FOR UPDATE USING (public.is_servant());
CREATE POLICY "Servants can delete buses" ON public.buses FOR DELETE USING (public.is_servant());

-- Rooms: everyone reads, servants manage
CREATE POLICY "Anyone can view rooms" ON public.rooms FOR SELECT USING (true);
CREATE POLICY "Servants can insert rooms" ON public.rooms FOR INSERT WITH CHECK (public.is_servant());
CREATE POLICY "Servants can update rooms" ON public.rooms FOR UPDATE USING (public.is_servant());
CREATE POLICY "Servants can delete rooms" ON public.rooms FOR DELETE USING (public.is_servant());

-- Bookings: users see own + insert own (open trips only), servants full access
CREATE POLICY "Users can view own bookings" ON public.bookings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Servants can view all bookings" ON public.bookings FOR SELECT USING (public.is_servant());
CREATE POLICY "Users can insert own bookings" ON public.bookings FOR INSERT
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.trips WHERE id = trip_id AND is_open = true));
CREATE POLICY "Servants can insert any booking" ON public.bookings FOR INSERT WITH CHECK (public.is_servant());
CREATE POLICY "Users can update own bookings" ON public.bookings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Servants can update any booking" ON public.bookings FOR UPDATE USING (public.is_servant());
CREATE POLICY "Servants can delete bookings" ON public.bookings FOR DELETE USING (public.is_servant());
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: add RLS policies for all tables with patient/servant access"
```

---

### Task 30: Supabase Edge Function for PDF reports

**Files:**
- Create: `supabase/functions/generate-report/index.ts`

- [ ] **Step 1: Create the Edge Function**

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface ReportRequest {
  trip_id: string;
  report_type: "bus" | "room";
}

Deno.serve(async (req) => {
  try {
    const { trip_id, report_type }: ReportRequest = await req.json();
    if (!trip_id || !report_type) {
      return new Response(JSON.stringify({ error: "trip_id and report_type are required" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: trip } = await supabase.from("trips").select("title_ar, title_en, trip_date").eq("id", trip_id).single();
    if (!trip) {
      return new Response(JSON.stringify({ error: "Trip not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
    }

    const pdfBytes = report_type === "bus"
      ? await generateBusReport(supabase, trip_id, trip)
      : await generateRoomReport(supabase, trip_id, trip);

    return new Response(pdfBytes, {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${report_type}-report.pdf"` },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});

async function generateBusReport(supabase: any, tripId: string, trip: any) {
  const { data: buses } = await supabase.from("buses").select("id, area_name_ar, area_name_en, capacity, leader_name").eq("trip_id", tripId);
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  let page = pdfDoc.addPage([595, 842]);
  let y = page.getSize().height - 50;

  page.drawText(`Bus Report - ${trip.title_en}`, { x: 50, y, size: 20, font, color: rgb(0,0,0) });
  y -= 30;
  page.drawText(`Date: ${trip.trip_date}`, { x: 50, y, size: 14, font, color: rgb(0.3,0.3,0.3) });
  y -= 40;

  for (const bus of buses ?? []) {
    if (y < 100) { page = pdfDoc.addPage([595, 842]); y = page.getSize().height - 50; }
    page.drawText(`${bus.area_name_en} (Leader: ${bus.leader_name || "N/A"})`, { x: 50, y, size: 16, font, color: rgb(0.1,0.4,0.1) });
    y -= 25;
    page.drawText(`Capacity: ${bus.capacity}`, { x: 70, y, size: 12, font, color: rgb(0.3,0.3,0.3) });
    y -= 25;

    const { data: bookings } = await supabase.from("bookings").select("profiles(full_name)").eq("bus_id", bus.id).is("cancelled_at", null);
    for (const b of bookings ?? []) {
      if (y < 50) { page = pdfDoc.addPage([595, 842]); y = page.getSize().height - 50; }
      page.drawText(`- ${(b.profiles as any)?.full_name || "Unknown"}`, { x: 90, y, size: 12, font, color: rgb(0,0,0) });
      y -= 20;
    }
    y -= 20;
  }
  return pdfDoc.save();
}

async function generateRoomReport(supabase: any, tripId: string, trip: any) {
  const { data: rooms } = await supabase.from("rooms").select("id, room_label, room_type, capacity, supervisor_name").eq("trip_id", tripId);
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  let page = pdfDoc.addPage([595, 842]);
  let y = page.getSize().height - 50;

  page.drawText(`Room Report - ${trip.title_en}`, { x: 50, y, size: 20, font, color: rgb(0,0,0) });
  y -= 30;
  page.drawText(`Date: ${trip.trip_date}`, { x: 50, y, size: 14, font, color: rgb(0.3,0.3,0.3) });
  y -= 40;

  for (const room of rooms ?? []) {
    if (y < 100) { page = pdfDoc.addPage([595, 842]); y = page.getSize().height - 50; }
    page.drawText(`${room.room_label} (${room.room_type}, Supervisor: ${room.supervisor_name || "N/A"})`, { x: 50, y, size: 16, font, color: rgb(0.1,0.4,0.1) });
    y -= 25;
    page.drawText(`Capacity: ${room.capacity}`, { x: 70, y, size: 12, font, color: rgb(0.3,0.3,0.3) });
    y -= 25;

    const { data: bookings } = await supabase.from("bookings").select("profiles(full_name)").eq("room_id", room.id).is("cancelled_at", null);
    for (const b of bookings ?? []) {
      if (y < 50) { page = pdfDoc.addPage([595, 842]); y = page.getSize().height - 50; }
      page.drawText(`- ${(b.profiles as any)?.full_name || "Unknown"}`, { x: 90, y, size: 12, font, color: rgb(0,0,0) });
      y -= 20;
    }
    y -= 20;
  }
  return pdfDoc.save();
}
```

- [ ] **Step 2: Commit**

```bash
mkdir -p supabase/functions/generate-report
git add -A
git commit -m "feat: add Supabase Edge Function for PDF bus and room reports"
```

---

### Task 31: Update root page to redirect to /trips

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Replace root page with redirect**

```typescript
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/trips");
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: redirect root page to /trips"
```
