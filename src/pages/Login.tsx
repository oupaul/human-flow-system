import { FormEvent, useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/apiClient";
import { authApi, MICROSOFT_LOGIN_URL } from "@/services/authApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const SSO_ERROR_KEYS = new Set([
  "no_account",
  "invalid_state",
  "invalid_request",
  "token_exchange_failed",
  "profile_fetch_failed",
  "no_email",
  "server_error",
  "microsoft_error",
  "not_configured",
]);

const Login = () => {
  const { t } = useTranslation(["auth", "common"]);
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ssoEnabled, setSsoEnabled] = useState(false);

  useEffect(() => {
    authApi.getMicrosoftSsoStatus().then((status) => setSsoEnabled(status.enabled));
  }, []);

  useEffect(() => {
    const ssoError = searchParams.get("ssoError");
    if (!ssoError) return;
    const key = SSO_ERROR_KEYS.has(ssoError) ? ssoError : "invalid_request";
    setError(t(`auth:login.sso.errors.${key}`));
  }, [searchParams, t]);

  if (user) {
    const redirectTo = user.role === "employee"
      ? "/my"
      : (location.state as { from?: string } | null)?.from || "/";
    return <Navigate to={redirectTo} replace />;
  }

  const handleMicrosoftLogin = () => {
    window.location.href = MICROSOFT_LOGIN_URL;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const loggedInUser = await login(username, password);
      navigate(loggedInUser.role === "employee" ? "/my" : "/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("auth:login.defaultError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher className="border-input bg-background" />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t("auth:login.title")}</CardTitle>
          <CardDescription>{t("auth:login.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">{t("auth:login.usernameLabel")}</Label>
              <Input
                id="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("auth:login.passwordLabel")}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? t("auth:login.loggingIn") : t("auth:login.loginButton")}
            </Button>
          </form>
          {ssoEnabled && (
            <>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-muted-foreground">{t("auth:login.sso.divider")}</span>
                </div>
              </div>
              <Button type="button" variant="outline" className="w-full" onClick={handleMicrosoftLogin}>
                {t("auth:login.sso.button")}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
