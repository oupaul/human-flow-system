import { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { KeyRound, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import ChangePasswordDialog from "@/components/ChangePasswordDialog";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const EmployeeLayout = () => {
  const { t } = useTranslation(["myPortal", "common"]);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="flex h-16 items-center justify-between bg-hrms-primary px-6 text-white shadow-sm">
        <h1 className="text-lg font-bold">{t("myPortal:title")}</h1>
        <div className="flex items-center gap-4">
          <LanguageSwitcher className="text-white [&_svg]:text-white" />
          <span className="text-sm">{user?.employeeName || user?.username}</span>
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-hrms-dark hover:text-white"
            onClick={() => setIsChangePasswordOpen(true)}
          >
            <KeyRound className="mr-2 h-4 w-4" />
            {t("common:actions.changePassword")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-hrms-dark hover:text-white"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {t("common:actions.logout")}
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-4xl p-6">
        <Outlet />
      </main>
      <ChangePasswordDialog open={isChangePasswordOpen} onOpenChange={setIsChangePasswordOpen} />
    </div>
  );
};

export default EmployeeLayout;
