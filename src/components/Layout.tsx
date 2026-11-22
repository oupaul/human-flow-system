
import { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  Users,
  Building2,
  Calendar,
  BarChart3,
  Menu,
  X,
  LogOut,
  KeyRound,
  Gift,
  Calculator,
  Settings as SettingsIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import ChangePasswordDialog from "@/components/ChangePasswordDialog";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const Layout = () => {
  const { t } = useTranslation("common");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const isMobile = useIsMobile();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const closeSidebarIfMobile = () => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  const menuItems = [
    { to: "/", icon: <LayoutDashboard className="h-5 w-5" />, label: t("nav.dashboard") },
    { to: "/employees", icon: <Users className="h-5 w-5" />, label: t("nav.employees") },
    { to: "/departments", icon: <Building2 className="h-5 w-5" />, label: t("nav.departments") },
    { to: "/leave-management", icon: <Calendar className="h-5 w-5" />, label: t("nav.leaveManagement") },
    { to: "/reports", icon: <BarChart3 className="h-5 w-5" />, label: t("nav.reports") },
    ...(user?.role === "admin" || user?.role === "hr"
      ? [{ to: "/seniority-benefits", icon: <Gift className="h-5 w-5" />, label: t("nav.seniorityBenefits") },
         { to: "/payroll", icon: <Calculator className="h-5 w-5" />, label: t("nav.payroll") }]
      : []),
    ...(user?.role === "admin"
      ? [{ to: "/settings", icon: <SettingsIcon className="h-5 w-5" />, label: t("nav.settings") }]
      : []),
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      {/* Sidebar Overlay */}
      {sidebarOpen && isMobile && (
        <div 
          className="fixed inset-0 z-20 bg-black bg-opacity-50 transition-opacity lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-30 w-64 transform bg-hrms-primary text-white transition-transform duration-300 ease-in-out lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between px-4">
          <h1 className="text-xl font-bold">{t("appName")}</h1>
          {isMobile && (
            <Button variant="ghost" size="icon" onClick={toggleSidebar} className="text-white">
              <X className="h-6 w-6" />
            </Button>
          )}
        </div>

        <nav className="mt-6 px-2">
          <ul className="space-y-1">
            {menuItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  onClick={closeSidebarIfMobile}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center rounded-md px-4 py-3 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-hrms-secondary text-white"
                        : "text-gray-300 hover:bg-hrms-dark hover:text-white"
                    )
                  }
                >
                  {item.icon}
                  <span className="ml-3">{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="absolute bottom-0 w-full p-4">
          <div className="space-y-1">
            <Button
              variant="ghost"
              className="w-full justify-start text-gray-300 hover:bg-hrms-dark hover:text-white"
              onClick={() => setIsChangePasswordOpen(true)}
            >
              <KeyRound className="mr-2 h-5 w-5" />
              {t("actions.changePassword")}
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start text-gray-300 hover:bg-hrms-dark hover:text-white"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-5 w-5" />
              {t("actions.logout")}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 items-center justify-between bg-white px-6 shadow-sm">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={toggleSidebar}
          >
            <Menu className="h-6 w-6" />
          </Button>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <div className="relative">
              <Button variant="ghost" size="sm" className="flex items-center">
                <img
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.username ?? "User")}&background=0D8ABC&color=fff`}
                  alt="Profile"
                  className="mr-2 h-8 w-8 rounded-full"
                />
                <span>{user?.username ?? "User"}</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
      <ChangePasswordDialog open={isChangePasswordOpen} onOpenChange={setIsChangePasswordOpen} />
    </div>
  );
};

export default Layout;
