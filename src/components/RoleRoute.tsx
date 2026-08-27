import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface RoleRouteProps {
  allow: string[];
  fallback: string;
}

const RoleRoute = ({ allow, fallback }: RoleRouteProps) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        載入中...
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
