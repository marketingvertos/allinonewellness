import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  ScanLine,
  ClipboardList,
  Trophy,
  Layers,
  Sparkles,
  Bell,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { NavLink } from "react-router-dom";
import { BrandLogo } from "@/components/BrandLogo";

const mainNav = [
  { title: "Dashboard", icon: LayoutDashboard, to: "/dashboard", end: true },
  { title: "Members", icon: Users, to: "/members", end: false },
  { title: "Check-in", icon: ScanLine, to: "/checkin", end: false },
  { title: "Plans", icon: ClipboardList, to: "/plans", end: false },
  { title: "Trials", icon: Sparkles, to: "/trials", end: false },
  { title: "Batches", icon: Layers, to: "/batches", end: false },
  { title: "Notifications", icon: Bell, to: "/notifications", end: false },
  { title: "Achievements", icon: Trophy, to: "/achievements", end: false },
];

export function AppSidebar() {
  const { signOut, user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["profile-sidebar", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("avatar_url, full_name").eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <NavLink to="/dashboard" className="flex items-center gap-3">
          <BrandLogo className="h-10 w-10" />
          <span className="min-w-0 leading-tight">
            <span className="block truncate font-display text-base font-semibold text-sidebar-foreground">
              All In One Wellness
            </span>
            <span className="block truncate text-[11px] uppercase tracking-[0.14em] text-sidebar-foreground/60">
              Shri Chatap
            </span>
          </span>
        </NavLink>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : ""
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 space-y-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink to="/settings">
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut}>
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {user && (
          <div className="flex items-center gap-2 px-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={profile?.avatar_url || ""} className="object-cover" />
              <AvatarFallback className="text-[10px]">{(profile?.full_name || user.email || "U").slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <p className="truncate text-xs text-sidebar-foreground/60">
              {profile?.full_name || user.email}
            </p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
