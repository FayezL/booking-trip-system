// Demo seed: 100 fake users (via Supabase admin API) + 2 trips + buses + rooms + ~40 bookings.
// Run against the DEMO Supabase project only. Idempotent.
//
// Usage:
//   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-DEMO.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx \
//   node scripts/seed-demo-data.mjs
//
// Or set those in .env.demo.local at repo root and run with `npm run seed:demo`.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// ---- Load .env.demo.local if present (manual loader, Node 18 compatible) ----
try {
  const envPath = resolve(process.cwd(), ".env.demo.local");
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  // .env.demo.local not present — fine, env vars may be set inline
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing env vars. Need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.");
  console.error("Set them inline or in .env.demo.local at repo root.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---- Data ----
const MALE_NAMES = [
  "Mina", "Abanoub", "Bishoy", "Peter", "George", "Michael", "Youssef", "Karim",
  "Fady", "Mark", "Andrew", "David", "Steven", "Tony", "Adel", "Emad",
  "Hany", "Nabil", "Raafat", "Samir", "Wagdy", "Amin", "Boutros", "Fouad", "Galal",
];
const FEMALE_NAMES = [
  "Mary", "Marina", "Verena", "Marianne", "Angela", "Mirna", "Nancy", "Sara",
  "Demiana", "Irene", "Maggie", "Mona", "Donia", "Mariam", "Carmen", "Sylvia",
  "Vera", "Martina", "Fify", "Sawsan", "Neveen", "Hala", "Lilian", "Rania", "Dina",
];
const LAST_NAMES = [
  "Sidhom", "Bebawy", "Messiha", "Gayed", "Wassef", "Aziz", "Mikhail", "Salib",
  "Ibrahim", "Marcus", "Felix", "Naguib", "Samaan", "Rofail", "Ayad", "Malek",
  "Hanna", "Sobhy", "Morkos", "Farag",
];

const TRIP_1 = "a1000000-0000-0000-0000-000000000001";
const TRIP_2 = "a1000000-0000-0000-0000-000000000002";
const BUS_IDS = Array.from({ length: 8 }, (_, i) => `b1000000-0000-0000-0000-00000000000${i + 1}`);
const ROOM_IDS = Array.from({ length: 10 }, (_, i) => `c1000000-0000-0000-0000-0000000000${String(i + 1).padStart(2, "0")}`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- Main ----
async function main() {
  console.log("→ Loading sectors…");
  const { data: sectors, error: sectorErr } = await supabase
    .from("sectors")
    .select("id, code");
  if (sectorErr) throw sectorErr;
  const sectorByCode = Object.fromEntries(sectors.map((s) => [s.code, s.id]));
  console.log(`  ${sectors.length} sectors found.`);

  console.log("→ Creating 100 demo users via admin API…");
  const userByPhone = {}; // phone -> user_id
  let created = 0, skipped = 0;
  for (let g = 1; g <= 100; g++) {
    const phone = `0990001${String(g).padStart(4, "0")}`;
    const gender = g <= 50 ? "Male" : "Female";
    const firstName = g <= 50
      ? MALE_NAMES[(g - 1) % 25]
      : FEMALE_NAMES[(g - 51) % 25];
    const lastName = LAST_NAMES[(g - 1) % 20];
    const fullName = `${firstName} ${lastName}`;
    const wheelchair = (g % 13 === 0);
    const transport = (g % 7 === 0) ? "private" : "bus";
    const servants = (g % 33 === 0) ? 2 : (g % 11 === 0) ? 1 : 0;
    const sectorCode = String((g - 1) % 15 + 1).padStart(2, "0");

    const { data, error } = await supabase.auth.admin.createUser({
      email: `${phone}@church.local`,
      password: "demo123",
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        gender,
        role: "patient",
        has_wheelchair: wheelchair,
        sector_id: sectorByCode[sectorCode], // trigger will cast to uuid
        transport_type: transport,
        servants_needed: servants,
      },
    });

    if (error) {
      if (error.message.includes("already") || error.code === 422) {
        // User exists — look up their id so we can still build bookings
        const { data: existing } = await supabase
          .from("profiles")
          .select("id")
          .eq("phone", phone)
          .maybeSingle();
        if (existing) userByPhone[phone] = existing.id;
        skipped++;
      } else {
        throw new Error(`Failed to create ${phone}: ${error.message}`);
      }
    } else {
      userByPhone[phone] = data.user.id;
      created++;
    }
    if (g % 20 === 0) {
      console.log(`  ${g}/100 done (${created} new, ${skipped} existing)`);
      await sleep(200); // be polite to the API
    }
  }
  console.log(`  Users: ${created} created, ${skipped} skipped.`);

  // Resolve head family_member ids for each user
  console.log("→ Resolving head family_member rows…");
  const userIds = Object.values(userByPhone);
  const { data: headFms, error: fmErr } = await supabase
    .from("family_members")
    .select("id, head_user_id")
    .in("head_user_id", userIds)
    .eq("is_head", true);
  if (fmErr) throw fmErr;
  const fmByUser = Object.fromEntries(headFms.map((fm) => [fm.head_user_id, fm.id]));
  console.log(`  ${headFms.length} head family_members found.`);

  // Trips
  console.log("→ Upserting demo trips…");
  const today = new Date();
  const date1 = new Date(today.getTime() + 14 * 86400000).toISOString().slice(0, 10);
  const date2 = new Date(today.getTime() + 35 * 86400000).toISOString().slice(0, 10);
  const { error: tripErr } = await supabase.from("trips").upsert(
    [
      { id: TRIP_1, title_ar: "[DEMO] رحلة دير الأنبا بيشوي", title_en: "[DEMO] Anba Bishoy Monastery Trip", trip_date: date1, is_open: true },
      { id: TRIP_2, title_ar: "[DEMO] رحلة دير السيدة العذراء", title_en: "[DEMO] Virgin Mary Monastery Trip", trip_date: date2, is_open: true },
    ],
    { onConflict: "id", ignoreDuplicates: true }
  );
  if (tripErr) throw tripErr;

  // Buses
  console.log("→ Upserting buses…");
  const busRows = [
    { id: BUS_IDS[0], trip_id: TRIP_1, area_name_ar: "شبرا",       area_name_en: "Shobra",     capacity: 45, leader_name: "Mina Adel",    bus_label: "Bus 1" },
    { id: BUS_IDS[1], trip_id: TRIP_1, area_name_ar: "مصر الجديدة", area_name_en: "Heliopolis", capacity: 45, leader_name: "Peter Samir",  bus_label: "Bus 2" },
    { id: BUS_IDS[2], trip_id: TRIP_1, area_name_ar: "المعادي",     area_name_en: "Maadi",      capacity: 40, leader_name: "George Nabil", bus_label: "Bus 3" },
    { id: BUS_IDS[3], trip_id: TRIP_1, area_name_ar: "الزيتون",     area_name_en: "Zaitoun",    capacity: 40, leader_name: "Karim Hany",   bus_label: "Bus 4" },
    { id: BUS_IDS[4], trip_id: TRIP_2, area_name_ar: "شبرا",       area_name_en: "Shobra",     capacity: 45, leader_name: "Mina Adel",    bus_label: "Bus 1" },
    { id: BUS_IDS[5], trip_id: TRIP_2, area_name_ar: "مصر الجديدة", area_name_en: "Heliopolis", capacity: 45, leader_name: "Peter Samir",  bus_label: "Bus 2" },
    { id: BUS_IDS[6], trip_id: TRIP_2, area_name_ar: "المعادي",     area_name_en: "Maadi",      capacity: 40, leader_name: "George Nabil", bus_label: "Bus 3" },
    { id: BUS_IDS[7], trip_id: TRIP_2, area_name_ar: "الزيتون",     area_name_en: "Zaitoun",    capacity: 40, leader_name: "Karim Hany",   bus_label: "Bus 4" },
  ];
  const { error: busErr } = await supabase.from("buses").upsert(busRows, { onConflict: "id", ignoreDuplicates: true });
  if (busErr) throw busErr;

  // Rooms
  console.log("→ Upserting rooms…");
  const roomRows = [
    { id: ROOM_IDS[0], trip_id: TRIP_1, room_type: "Male",   capacity: 8, supervisor_name: "Abouna Bishoy", room_label: "Ground A" },
    { id: ROOM_IDS[1], trip_id: TRIP_1, room_type: "Male",   capacity: 8, supervisor_name: "Abouna Bishoy", room_label: "Ground B" },
    { id: ROOM_IDS[2], trip_id: TRIP_1, room_type: "Male",   capacity: 6, supervisor_name: "Abouna Bishoy", room_label: "Upper A" },
    { id: ROOM_IDS[3], trip_id: TRIP_1, room_type: "Female", capacity: 8, supervisor_name: "Tasoni Mary",   room_label: "Ground C" },
    { id: ROOM_IDS[4], trip_id: TRIP_1, room_type: "Female", capacity: 8, supervisor_name: "Tasoni Mary",   room_label: "Ground D" },
    { id: ROOM_IDS[5], trip_id: TRIP_2, room_type: "Male",   capacity: 8, supervisor_name: "Abouna Bishoy", room_label: "Ground A" },
    { id: ROOM_IDS[6], trip_id: TRIP_2, room_type: "Male",   capacity: 8, supervisor_name: "Abouna Bishoy", room_label: "Ground B" },
    { id: ROOM_IDS[7], trip_id: TRIP_2, room_type: "Male",   capacity: 6, supervisor_name: "Abouna Bishoy", room_label: "Upper A" },
    { id: ROOM_IDS[8], trip_id: TRIP_2, room_type: "Female", capacity: 8, supervisor_name: "Tasoni Mary",   room_label: "Ground C" },
    { id: ROOM_IDS[9], trip_id: TRIP_2, room_type: "Female", capacity: 8, supervisor_name: "Tasoni Mary",   room_label: "Ground D" },
  ];
  const { error: roomErr } = await supabase.from("rooms").upsert(roomRows, { onConflict: "id", ignoreDuplicates: true });
  if (roomErr) throw roomErr;

  // Bookings on trip 1 (20 male + 20 female; ~16 with rooms)
  console.log("→ Creating bookings on trip 1…");
  const bookings = [];
  for (let i = 1; i <= 20; i++) {
    // Male
    const malePhone = `0990001${String(i).padStart(4, "0")}`;
    const maleUser = userByPhone[malePhone];
    if (maleUser) {
      bookings.push({
        user_id: maleUser,
        trip_id: TRIP_1,
        bus_id: BUS_IDS[(i - 1) % 4],
        room_id: i <= 3 ? ROOM_IDS[0] : i <= 6 ? ROOM_IDS[1] : i <= 8 ? ROOM_IDS[2] : null,
        family_member_id: fmByUser[maleUser] ?? null,
      });
    }
    // Female
    const femalePhone = `0990001${String(50 + i).padStart(4, "0")}`;
    const femaleUser = userByPhone[femalePhone];
    if (femaleUser) {
      bookings.push({
        user_id: femaleUser,
        trip_id: TRIP_1,
        bus_id: BUS_IDS[(i - 1) % 4],
        room_id: i <= 4 ? ROOM_IDS[3] : i <= 8 ? ROOM_IDS[4] : null,
        family_member_id: fmByUser[femaleUser] ?? null,
      });
    }
  }
  // Insert bookings one at a time (some may already exist on re-run)
  let bookingCount = 0;
  for (const b of bookings) {
    const { error } = await supabase.from("bookings").insert(b).select().maybeSingle();
    if (error && !error.message.includes("duplicate")) {
      // ignore duplicate-key errors (idempotent re-run)
      console.warn(`    booking warn: ${error.message}`);
    } else {
      bookingCount++;
    }
  }
  console.log(`  ${bookingCount} bookings ensured.`);

  // Demo account pool
  console.log("→ Populating demo_account_pool…");
  const poolPhones = Object.keys(userByPhone);
  const { error: poolErr } = await supabase
    .from("demo_account_pool")
    .upsert(poolPhones.map((phone) => ({ phone })), { onConflict: "phone", ignoreDuplicates: true });
  if (poolErr) throw poolErr;
  console.log(`  Pool populated with ${poolPhones.length} phones.`);

  console.log("\n✅ Demo seed complete.");
  console.log(`   Users: ${created} new + ${skipped} existing`);
  console.log(`   Trips: 2 | Buses: 8 | Rooms: 10 | Bookings: ${bookingCount}`);
}

main().catch((e) => {
  console.error("\n❌ Seed failed:", e.message);
  process.exit(1);
});
