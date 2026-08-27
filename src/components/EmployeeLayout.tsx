import { Outlet, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const EmployeeLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="flex h-16 items-center justify-between bg-hrms-primary px-6 text-white shadow-sm">
        <h1 className="text-lg font-bold">員工自助服務</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm">{user?.employeeName || user?.username}</span>
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-hrms-dark hover:text-white"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            登出
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-4xl p-6">
        <Outlet />
      </main>
    </div>
  );
};

export default EmployeeLayout;
