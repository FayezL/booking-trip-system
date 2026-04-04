import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import Header from "@/components/Header";
import MobileNav from "@/components/MobileNav";
import type { Profile } from "@/lib/types/database";

const getProfile = cache(async (userId: string) => {
  const supabase = await createClient();
  return supabase.from("profiles").select("*").eq("id", userId).single();
});

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

  const { data: profile } = await getProfile(user.id);

  if (!profile) {
    redirect("/login");
  }

  return (
    <>
      <Header profile={profile as Profile} />
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-6 pb-24 md:pb-6">
        {children}
      </main>
      <MobileNav profile={profile as Profile} />
    </>
  );
}
