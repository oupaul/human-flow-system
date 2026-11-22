import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { authApi } from "@/services/authApi";
import { ApiError } from "@/lib/apiClient";
import { finishMicrosoftLogin, MicrosoftSsoError } from "@/lib/microsoftSso";
import { Loader2 } from "lucide-react";

// Microsoft 登入完成後導回這裡（網址帶 ?code=...&state=...）：
// 瀏覽器用 PKCE 向 Microsoft 換 id_token → 交給後端驗證 → 換成系統登入 token。整個流程沒有任何 client secret
const SsoCallback = () => {
  const { t } = useTranslation(["auth", "common"]);
  const { completeSsoLogin } = useAuth();
  const navigate = useNavigate();
  const ranOnce = useRef(false);

  useEffect(() => {
    if (ranOnce.current) return;
    ranOnce.current = true;

    const fail = (code: string) => navigate(`/login?ssoError=${encodeURIComponent(code)}`, { replace: true });

    (async () => {
      try {
        const { idToken, nonce } = await finishMicrosoftLogin(window.location.search);
        const token = await authApi.exchangeMicrosoftIdToken(idToken, nonce);
        const user = await completeSsoLogin(token);
        if (!user) return fail("invalid_request");
        navigate(user.role === "employee" ? "/my" : "/", { replace: true });
      } catch (error) {
        if (error instanceof MicrosoftSsoError) return fail(error.code);
        if (error instanceof ApiError && error.code) return fail(error.code);
        fail("server_error");
      }
    })();
  }, [completeSsoLogin, navigate]);

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
