import { SupabaseClient } from "@supabase/supabase-js";

export async function bookTripOnly(
  supabase: SupabaseClient,
  { userId, tripId, familyMemberIds }: { userId: string; tripId: string; familyMemberIds: string[] }
) {
  const { error } = await supabase.rpc("book_trip_only_with_family", {
    p_user_id: userId,
    p_trip_id: tripId,
    p_family_member_ids: familyMemberIds,
  });
  return { error };
}

export function toggleInSet(set: Set<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
