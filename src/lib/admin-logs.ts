import { createClient } from "@/lib/supabase/client";

export async function logAction(
  action: string,
  targetType?: string,
  targetId?: string,
  details?: Record<string, unknown>
) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("admin_logs").insert({
      admin_id: user.id,
      action,
      target_type: targetType || null,
      target_id: targetId || null,
      details: details || {},
    });
  } catch {}
}
