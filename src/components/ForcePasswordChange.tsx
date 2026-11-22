import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { authApi } from "@/services/authApi";
import { ApiError } from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";

// 首次登入（或密碼被重設為預設值）後必須先改密碼才能使用系統：這個對話框無法關閉，只能改密碼或登出。
// 預設密碼是員工編號，不改的話別人只要知道編號就能冒用帳號（包含替人打卡）
const ForcePasswordChange = () => {
  const { t } = useTranslation(["auth", "common"]);
  const { user, markPasswordChanged, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!user?.mustChangePassword) return null;

  const submit = async () => {
    setError(null);
    if (!currentPassword || !newPassword || !confirmPassword) return setError(t("auth:changePassword.errors.fillAll"));
    if (newPassword !== confirmPassword) return setError(t("auth:changePassword.errors.mismatch"));
    if (newPassword.length < 8) return setError(t("auth:changePassword.errors.tooShort"));
    setSubmitting(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      markPasswordChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("auth:changePassword.errors.default"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => undefined}>
      <DialogContent className="sm:max-w-[420px] [&>button]:hidden" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{t("auth:forceChange.title")}</DialogTitle>
          <DialogDescription>{t("auth:forceChange.description")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label>{t("auth:changePassword.currentPasswordLabel")}</Label>
            <Input type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>{t("auth:changePassword.newPasswordLabel")}</Label>
            <Input type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>{t("auth:changePassword.confirmPasswordLabel")}</Label>
            <Input type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={logout}>{t("common:actions.logout")}</Button>
          <Button onClick={submit} disabled={submitting}>{t("auth:changePassword.confirmButton")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ForcePasswordChange;
