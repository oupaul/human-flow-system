
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import Departments from "./pages/Departments";
import LeaveManagement from "./pages/LeaveManagement";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import SsoCallback from "./pages/SsoCallback";
import MyPortal from "./pages/MyPortal";
import NotFound from "./pages/NotFound";
import Layout from "./components/Layout";
import EmployeeLayout from "./components/EmployeeLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleRoute from "./components/RoleRoute";
import { AuthProvider } from "./contexts/AuthContext";
import { STAFF_ROLES } from "./services/authApi";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/sso-callback" element={<SsoCallback />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<RoleRoute allow={["employee"]} fallback="/" />}>
                <Route path="/my" element={<EmployeeLayout />}>
                  <Route index element={<MyPortal />} />
                </Route>
              </Route>
              <Route element={<RoleRoute allow={[...STAFF_ROLES]} fallback="/my" />}>
                <Route path="/" element={<Layout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="employees" element={<Employees />} />
                  <Route path="departments" element={<Departments />} />
                  <Route path="leave-management" element={<LeaveManagement />} />
                  <Route path="reports" element={<Reports />} />
                  <Route element={<RoleRoute allow={["admin"]} fallback="/" />}>
                    <Route path="settings" element={<Settings />} />
                  </Route>
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
