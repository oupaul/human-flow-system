import { FormEvent, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const Login = () => {
  const { t } = useTranslation(["auth", "common"]);
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (user) {
    const redirectTo = user.role === "employee"
      ? "/my"
      : (location.state as { from?: string } | null)?.from || "/";
    return <Navigate to={redirectTo} replace />;
  }

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
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
