import { Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useMemberIdentity } from "@/hooks/useMemberIdentity";
import { Button } from "@/components/ui/button";
import { HeartPulse, History, Loader2, LogOut, QrCode } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/portal", label: "My plan", icon: HeartPulse, end: true },
  { to: "/portal/checkin", label: "Check in", icon: QrCode, end: false },
  { to: "/portal/history", label: "History", icon: History, end: false },
];

export function PortalLayout() {
  const { session, loading, signOut } = useAuth();
  const { data: identity, isLoading } = useMemberIdentity();
  const location = useLocation();

  if (loading || (session && isLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/portal/auth?next=${next}`} replace />;
  }

  if (identity && !identity.memberId) {
    return <Navigate to={identity.isStaff ? "/dashboard" : "/auth"} replace />;
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b bg-background px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <HeartPulse className="h-5 w-5 shrink-0 text-primary" />
          <span className="truncate font-semibold">{identity?.memberName ?? "Member"}</span>
        </div>
        <Button variant="ghost" size="sm" className="shrink-0" onClick={signOut}>
          <LogOut className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Sign out</span>
        </Button>
      </header>

      {/* Desktop / tablet navigation */}
      <nav className="hidden border-b bg-background sm:flex">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              cn(
                "flex flex-1 items-center justify-center gap-2 border-b-2 px-3 py-3 text-sm",
                isActive ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground",
              )
            }
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </NavLink>
        ))}
      </nav>

      <main className="mx-auto w-full max-w-2xl p-4 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] sm:pb-6">
        <Outlet />
      </main>

      {/* Thumb-reachable mobile navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-3 border-t bg-background pb-[env(safe-area-inset-bottom)] sm:hidden">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              cn(
                "flex min-h-[56px] flex-col items-center justify-center gap-1 text-xs",
                isActive ? "font-medium text-primary" : "text-muted-foreground",
              )
            }
          >
            <t.icon className="h-5 w-5" />
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

