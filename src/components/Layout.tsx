
import { useState } from "react";
import { Outlet, NavLink } from "react-router-dom";
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  Calendar, 
  BarChart3, 
  Menu, 
  X, 
  LogOut, 
  Settings 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const closeSidebarIfMobile = () => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  const menuItems = [
    { to: "/", icon: <LayoutDashboard className="h-5 w-5" />, label: "Dashboard" },
    { to: "/employees", icon: <Users className="h-5 w-5" />, label: "Employees" },
    { to: "/departments", icon: <Building2 className="h-5 w-5" />, label: "Departments" },
    { to: "/leave-management", icon: <Calendar className="h-5 w-5" />, label: "Leave Management" },
    { to: "/reports", icon: <BarChart3 className="h-5 w-5" />, label: "Reports" },
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
          <h1 className="text-xl font-bold">HR管理系統</h1>
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
            <Button variant="ghost" className="w-full justify-start text-gray-300 hover:bg-hrms-dark hover:text-white">
              <Settings className="mr-2 h-5 w-5" />
              設置
            </Button>
            <Button variant="ghost" className="w-full justify-start text-gray-300 hover:bg-hrms-dark hover:text-white">
              <LogOut className="mr-2 h-5 w-5" />
              登出
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

          <div className="flex items-center">
            <div className="relative">
              <Button variant="ghost" size="sm" className="flex items-center">
                <img
                  src="https://ui-avatars.com/api/?name=Admin+User&background=0D8ABC&color=fff"
                  alt="Profile"
                  className="mr-2 h-8 w-8 rounded-full"
                />
                <span>Admin User</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
