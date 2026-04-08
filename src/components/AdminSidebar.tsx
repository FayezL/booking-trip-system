"use client";

import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Map,
  Ticket,
  FileText,
  Users,
  ScrollText,
  LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { Profile } from "@/lib/types/database";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  roles?: Profile["role"][];
}

const navItems: NavItem[] = [
  { href: "/admin", labelKey: "admin.dashboard", icon: LayoutDashboard, roles: ["super_admin", "admin", "servant"] },
  { href: "/admin/trips", labelKey: "admin.trips", icon: Map, roles: ["super_admin", "admin", "servant"] },
  { href: "/trips", labelKey: "trips.myBookings", icon: Ticket, roles: ["super_admin", "admin", "servant"] },
  { href: "/admin/reports", labelKey: "admin.reports", icon: FileText, roles: ["super_admin", "admin", "servant"] },
  { href: "/admin/users", labelKey: "admin.users", icon: Users, roles: ["super_admin", "admin"] },
  { href: "/admin/logs", labelKey: "admin.activityLogs", icon: ScrollText, roles: ["super_admin"] },
];

interface AdminSidebarProps {
  profile: Profile;
}

export default function AdminSidebar({ profile }: AdminSidebarProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  function isActive(href: string): boolean {
    if (href === "/admin") return pathname === "/admin";
    if (href === "/trips") return pathname === "/trips" || (pathname.startsWith("/trips/") && !pathname.startsWith("/admin/trips"));
    return pathname.startsWith(href);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const initials = profile.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const roleLabel = t(`admin.${profile.role === "super_admin" ? "superAdmin" : profile.role === "admin" ? "adminRole" : "servant"}`);

  return (
    <aside className="hidden lg:flex flex-col w-64 border-s bg-card sticky top-0 h-screen">
      <div className="flex-1 px-3 py-4 space-y-1">
        {navItems
          .filter((item) => !item.roles || item.roles.includes(profile.role))
          .map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Button
                key={item.href}
                variant={active ? "default" : "ghost"}
                size="default"
                className={`w-full justify-start gap-2 ${active ? "bg-primary text-primary-foreground" : ""}`}
                onClick={() => router.push(item.href)}
              >
                <Icon className="size-4" />
                {t(item.labelKey)}
              </Button>
            );
          })}
      </div>

      <Separator />

      <div className="p-3 space-y-3">
        <div className="flex items-center gap-3">
          <Avatar size="sm">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{profile.full_name}</p>
            <Badge variant="secondary" className="text-[10px] mt-0.5">
              {roleLabel}
            </Badge>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-destructive hover:text-destructive"
          onClick={handleLogout}
        >
          <LogOut className="size-4" />
          {t("auth.logout")}
        </Button>
      </div>
    </aside>
  );
}
