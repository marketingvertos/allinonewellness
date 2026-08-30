import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "next-themes";

import { AppLayout } from "@/components/AppLayout";
import Auth from "./pages/Auth";
import Settings from "./pages/Settings";
import WellnessDashboard from "./pages/WellnessDashboard";
import WellnessMembers from "./pages/WellnessMembers";
import WellnessCheckIn from "./pages/WellnessCheckIn";
import WellnessPlans from "./pages/WellnessPlans";
import WellnessQr from "./pages/WellnessQr";
import WellnessAchievements from "./pages/WellnessAchievements";
import WellnessBatches from "./pages/WellnessBatches";
import WellnessTrials from "./pages/WellnessTrials";
import WellnessNotifications from "./pages/WellnessNotifications";
import { PortalLayout } from "./pages/portal/PortalLayout";
import PortalAuth from "./pages/portal/PortalAuth";
import PortalHome from "./pages/portal/PortalHome";
import PortalCheckIn from "./pages/portal/PortalCheckIn";
import PortalHistory from "./pages/portal/PortalHistory";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Navigate to="/auth" replace />} />
              <Route path="/auth" element={<Auth />} />
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<WellnessDashboard />} />
                <Route path="/members" element={<WellnessMembers />} />
                <Route path="/checkin" element={<WellnessCheckIn />} />
                <Route path="/plans" element={<WellnessPlans />} />
                <Route path="/qr" element={<WellnessQr />} />
                <Route path="/achievements" element={<WellnessAchievements />} />
                <Route path="/batches" element={<WellnessBatches />} />
                <Route path="/trials" element={<WellnessTrials />} />
                <Route path="/notifications" element={<WellnessNotifications />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
              {/* Legacy wellness paths — keep printed QR posters and old links working */}
              <Route path="/wellness" element={<Navigate to="/dashboard" replace />} />
              <Route path="/wellness/members" element={<Navigate to="/members" replace />} />
              <Route path="/wellness/checkin" element={<Navigate to="/checkin" replace />} />
              <Route path="/wellness/plans" element={<Navigate to="/plans" replace />} />
              <Route path="/wellness/qr" element={<Navigate to="/qr" replace />} />
              <Route path="/wellness/achievements" element={<Navigate to="/achievements" replace />} />
              <Route path="/wellness/batches" element={<Navigate to="/batches" replace />} />
              <Route path="/wellness/trials" element={<Navigate to="/trials" replace />} />
              <Route path="/wellness/notifications" element={<Navigate to="/notifications" replace />} />
              <Route path="/portal/auth" element={<PortalAuth />} />
              <Route element={<PortalLayout />}>
                <Route path="/portal" element={<PortalHome />} />
                <Route path="/portal/checkin" element={<PortalCheckIn />} />
                <Route path="/portal/history" element={<PortalHistory />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
