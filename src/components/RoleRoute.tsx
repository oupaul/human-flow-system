import { Navigate, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";

interface RoleRouteProps {
  allow: string[];
  fallback: string;
}

const RoleRoute = ({ allow, fallback }: RoleRouteProps) => {
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

  if (!allow.includes(user.role)) {
    return <Navigate to={fallback} replace />;
  }

  return <Outlet />;
};

export default RoleRoute;
