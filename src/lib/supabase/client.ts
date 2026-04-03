import { createBrowserClient } from "@supabase/ssr";

let client: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (client) return client;
  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return client;
}

export function setSessionPersistence(remember: boolean) {
  if (!remember) {
    try {
      const key = `sb-${process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/^https?:\/\//, "")}-auth-token`;
      const value = localStorage.getItem(key);
      if (value) {
        sessionStorage.setItem(key, value);
        localStorage.removeItem(key);
      }
    } catch {}
  }
}
