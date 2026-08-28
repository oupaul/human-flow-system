import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

const SsoCallback = () => {
  const { t } = useTranslation(["auth", "common"]);
  const { completeSsoLogin } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const ranOnce = useRef(false);

  useEffect(() => {
    if (ranOnce.current) return;
    ranOnce.current = true;

    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const token = params.get("token");

    if (!token) {
      navigate("/login?ssoError=invalid_request", { replace: true });
      return;
    }

    completeSsoLogin(token)
      .then((user) => {
        if (!user) {
          navigate("/login?ssoError=invalid_request", { replace: true });
          return;
        }
        navigate(user.role === "employee" ? "/my" : "/", { replace: true });
      })
      .catch(() => {
        setError(t("auth:login.defaultError"));
      });
  }, [completeSsoLogin, navigate, t]);

  if (error) {
    return <Navigate to="/login?ssoError=invalid_request" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p>{t("common:common.loading")}</p>
      </div>
    </div>
  );
};

export default SsoCallback;
