import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Header from "@/components/Header";
import type { Profile } from "@/lib/types/database";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  return (
    <>
      <Header profile={profile as Profile} />
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </>
  );
}
