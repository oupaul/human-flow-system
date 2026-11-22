import { Navigate, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import ForcePasswordChange from "@/components/ForcePasswordChange";

const ProtectedRoute = () => {
  const { t } = useTranslation("common");
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 必須先改密碼的帳號：畫面照常載入但被無法關閉的改密碼對話框蓋住；後端也會擋掉改密碼以外的 API
  if (user.mustChangePassword) {
    return <ForcePasswordChange />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
