// Demo cleanup: idempotent teardown of all demo data.
// Run against the DEMO Supabase project only.
//
// Usage:
//   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-DEMO.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx \
//   node scripts/cleanup-demo-data.mjs

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

try {
  const envPath = resolve(process.cwd(), ".env.demo.local");
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  // ignore
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing env vars. Need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // Find demo profiles (by phone pattern)
  const { data: demoProfiles, error: pErr } = await supabase
    .from("profiles")
    .select("id")
    .like("phone", "099%");
  if (pErr) throw pErr;
  const demoUserIds = (demoProfiles ?? []).map((p) => p.id);

  // Find demo trips
  const { data: demoTrips, error: tErr } = await supabase
    .from("trips")
    .select("id")
    .like("title_en", "[DEMO]%");
  if (tErr) throw tErr;

  if (demoUserIds.length === 0 && (demoTrips ?? []).length === 0) {
    console.log("Nothing to clean. No demo data found.");
    return;
  }

  console.log(`→ Found ${demoUserIds.length} demo users and ${demoTrips?.length ?? 0} demo trips.`);

  // 1. Delete demo trips (cascades buses, rooms, cars, bookings on those trips)
  if (demoTrips && demoTrips.length > 0) {
    const ids = demoTrips.map((t) => t.id);
    console.log("→ Deleting demo trips (cascades buses/rooms/bookings)…");
    const { error } = await supabase.from("trips").delete().in("id", ids);
    if (error) throw error;
  }

  // 2. Delete any remaining bookings tied to demo users (should already be gone via trip cascade)
  if (demoUserIds.length > 0) {
    console.log("→ Deleting residual demo-user bookings…");
    const { error, count } = await supabase
      .from("bookings")
      .delete({ count: "exact" })
      .in("user_id", demoUserIds);
    if (error) throw error;
    console.log(`  Removed ${count ?? 0} residual bookings.`);
  }

  // 3. Delete demo auth.users via admin API (cascades auth.identities, profiles, family_members)
  console.log("→ Deleting demo auth users via admin API…");
  let deleted = 0;
  for (const id of demoUserIds) {
    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error && !error.message.includes("not found")) {
      console.warn(`  warn: failed to delete user ${id}: ${error.message}`);
    } else {
      deleted++;
    }
    if (deleted % 20 === 0 && deleted > 0) await sleep(200);
  }
  console.log(`  Deleted ${deleted} auth users.`);

  // 4. Truncate the round-robin pool
  console.log("→ Clearing demo_account_pool…");
  const { error: poolErr } = await supabase.from("demo_account_pool").delete().neq("phone", "");
  if (poolErr) throw poolErr;

  // Verify
  const { data: leftover } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .like("phone", "099%");
  if ((leftover ?? []).length > 0) {
    throw new Error(`Cleanup incomplete: ${leftover.length} demo profiles still remain.`);
  }

  console.log("\n✅ Demo cleanup complete.");
}

main().catch((e) => {
  console.error("\n❌ Cleanup failed:", e.message);
  process.exit(1);
});
