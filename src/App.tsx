import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Cities from "./pages/Cities";
import Districts from "./pages/Districts";
import Areas from "./pages/Areas";
import Partners from "./pages/Partners";
import ServiceCategories from "./pages/ServiceCategories";
import Services from "./pages/Services";
import PartnerServiceLocations from "./pages/PartnerServiceLocations";
import ServiceLocations from "./pages/ServiceLocations";
import SyncHistory from "./pages/SyncHistory";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/cities" element={<Cities />} />
            <Route path="/districts" element={<Districts />} />
            <Route path="/areas" element={<Areas />} />
            <Route path="/service-categories" element={<ServiceCategories />} />
            <Route path="/services" element={<Services />} />
            <Route path="/partners" element={<Partners />} />
            <Route path="/partner-service-locations" element={<PartnerServiceLocations />} />
            <Route path="/service-locations" element={<ServiceLocations />} />
            <Route path="/sync-history" element={<SyncHistory />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
