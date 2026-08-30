import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useMemberIdentity } from "@/hooks/useMemberIdentity";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { GlobalSearch } from "./GlobalSearch";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationCenter } from "./NotificationCenter";
import { Loader2 } from "lucide-react";

export function AppLayout() {
  const { session, loading } = useAuth();
  const { data: identity, isLoading: identityLoading } = useMemberIdentity();

  if (loading || (session && identityLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;

  // Wellness members without a staff role belong in the member portal.
  if (identity && !identity.isStaff && identity.memberId) return <Navigate to="/portal" replace />;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <div className="flex items-center gap-2 px-4 py-3">
            <SidebarTrigger />
            <div className="ml-auto flex items-center gap-2">
              <GlobalSearch />
              <NotificationCenter />
              <ThemeToggle />
            </div>
          </div>
          <div className="p-4 md:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
