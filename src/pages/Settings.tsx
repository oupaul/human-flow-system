import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { notificationSettingsApi } from "@/services/notificationSettingsApi";
import { NotificationSettingsFormData } from "@/types/notificationSettings";
import { ApiError } from "@/lib/apiClient";

const emptyForm: NotificationSettingsFormData = {
  channel: "none",
  smtpHost: "",
  smtpPort: "587",
  smtpSecure: false,
  smtpFrom: "",
  notificationToEmails: "",
  smtpAuthMethod: "basic",
  smtpUser: "",
  smtpPassword: "",
  smtpOauthUser: "",
  smtpOauthClientId: "",
  smtpOauthClientSecret: "",
  smtpOauthRefreshToken: "",
  teamsWebhookUrl: "",
};

const Settings = () => {
  const [form, setForm] = useState<NotificationSettingsFormData>(emptyForm);
  const [hasSmtpPassword, setHasSmtpPassword] = useState(false);
  const [hasSmtpOauthClientSecret, setHasSmtpOauthClientSecret] = useState(false);
  const [hasSmtpOauthRefreshToken, setHasSmtpOauthRefreshToken] = useState(false);
  const [hasTeamsWebhookUrl, setHasTeamsWebhookUrl] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const settings = await notificationSettingsApi.getSettings();
      setForm({
        channel: settings.channel,
        smtpHost: settings.smtpHost || "",
        smtpPort: settings.smtpPort ? String(settings.smtpPort) : "587",
        smtpSecure: settings.smtpSecure,
        smtpFrom: settings.smtpFrom || "",
        notificationToEmails: settings.notificationToEmails || "",
        smtpAuthMethod: settings.smtpAuthMethod,
        smtpUser: settings.smtpUser || "",
        smtpPassword: "",
        smtpOauthUser: settings.smtpOauthUser || "",
        smtpOauthClientId: settings.smtpOauthClientId || "",
        smtpOauthClientSecret: "",
        smtpOauthRefreshToken: "",
        teamsWebhookUrl: "",
      });
      setHasSmtpPassword(settings.hasSmtpPassword);
      setHasSmtpOauthClientSecret(settings.hasSmtpOauthClientSecret);
      setHasSmtpOauthRefreshToken(settings.hasSmtpOauthRefreshToken);
      setHasTeamsWebhookUrl(settings.hasTeamsWebhookUrl);
    } catch (error) {
      console.error("Failed to load notification settings:", error);
      toast.error("載入通知設定失敗", {
        description: "請檢查網路連線或聯繫系統管理員",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await notificationSettingsApi.updateSettings(form);
      toast.success("通知設定已儲存");
      await loadSettings();
    } catch (error) {
      toast.error("儲存失敗", {
        description: error instanceof ApiError ? error.message : "請檢查網路連線或聯繫系統管理員",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    try {
      await notificationSettingsApi.sendTest();
      toast.success("測試通知已送出", {
        description: "請確認是否實際收到（email 請檢查垃圾郵件匣）。",
      });
    } catch (error) {
      toast.error("測試通知發送失敗", {
        description: error instanceof ApiError ? error.message : "請檢查設定內容是否正確",
      });
    } finally {
      setIsTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">載入中...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">系統設定</h1>

      <Card>
        <CardHeader>
          <CardTitle>通知設定</CardTitle>
          <CardDescription>
            員工送出請假或加班申請時，主動通知 HR/主管去審核。可選擇不發送、寄送 email（支援一般帳密或 OAuth2），或發到 Microsoft Teams 頻道。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="channel">通知通道</Label>
            <Select value={form.channel} onValueChange={(value) => setForm({ ...form, channel: value as NotificationSettingsFormData["channel"] })}>
              <SelectTrigger id="channel" className="w-[240px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">不發送</SelectItem>
                <SelectItem value="smtp">Email（SMTP）</SelectItem>
                <SelectItem value="teams">Microsoft Teams</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.channel === "smtp" && (
            <div className="space-y-4 rounded-md border p-4">
              <div className="space-y-2">
                <Label htmlFor="notificationToEmails">收通知的信箱（多個以逗號分隔）</Label>
                <Input
                  id="notificationToEmails"
                  placeholder="hr@example.com,manager@example.com"
                  value={form.notificationToEmails}
                  onChange={(e) => setForm({ ...form, notificationToEmails: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="smtpHost">SMTP 主機</Label>
                  <Input id="smtpHost" value={form.smtpHost} onChange={(e) => setForm({ ...form, smtpHost: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpPort">連接埠</Label>
                  <Input id="smtpPort" type="number" value={form.smtpPort} onChange={(e) => setForm({ ...form, smtpPort: e.target.value })} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="smtpSecure" checked={form.smtpSecure} onCheckedChange={(checked) => setForm({ ...form, smtpSecure: checked })} />
                <Label htmlFor="smtpSecure">使用 SSL/TLS（465 埠通常需要開啟）</Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtpFrom">寄件人信箱</Label>
                <Input id="smtpFrom" placeholder="hrms@example.com" value={form.smtpFrom} onChange={(e) => setForm({ ...form, smtpFrom: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtpAuthMethod">驗證方式</Label>
                <Select value={form.smtpAuthMethod} onValueChange={(value) => setForm({ ...form, smtpAuthMethod: value as "basic" | "oauth2" })}>
                  <SelectTrigger id="smtpAuthMethod" className="w-[240px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">帳號密碼</SelectItem>
                    <SelectItem value="oauth2">OAuth2（Microsoft 365 / Google Workspace 等）</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.smtpAuthMethod === "basic" ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="smtpUser">SMTP 帳號</Label>
                    <Input id="smtpUser" value={form.smtpUser} onChange={(e) => setForm({ ...form, smtpUser: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtpPassword">SMTP 密碼</Label>
                    <Input
                      id="smtpPassword"
                      type="password"
                      placeholder={hasSmtpPassword ? "已設定，留空表示不變更" : "尚未設定"}
                      value={form.smtpPassword}
                      onChange={(e) => setForm({ ...form, smtpPassword: e.target.value })}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="smtpOauthUser">信箱帳號</Label>
                    <Input id="smtpOauthUser" value={form.smtpOauthUser} onChange={(e) => setForm({ ...form, smtpOauthUser: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="smtpOauthClientId">OAuth Client ID</Label>
                      <Input id="smtpOauthClientId" value={form.smtpOauthClientId} onChange={(e) => setForm({ ...form, smtpOauthClientId: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtpOauthClientSecret">OAuth Client Secret</Label>
                      <Input
                        id="smtpOauthClientSecret"
                        type="password"
                        placeholder={hasSmtpOauthClientSecret ? "已設定，留空表示不變更" : "尚未設定"}
                        value={form.smtpOauthClientSecret}
                        onChange={(e) => setForm({ ...form, smtpOauthClientSecret: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtpOauthRefreshToken">Refresh Token</Label>
                    <Input
                      id="smtpOauthRefreshToken"
                      type="password"
                      placeholder={hasSmtpOauthRefreshToken ? "已設定，留空表示不變更" : "尚未設定"}
                      value={form.smtpOauthRefreshToken}
                      onChange={(e) => setForm({ ...form, smtpOauthRefreshToken: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      需先到信箱服務商後台（如 Microsoft Entra ID、Google Cloud Console）申請應用程式並取得 refresh token，這是一次性設定，本系統不提供 OAuth 授權頁面。
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {form.channel === "teams" && (
            <div className="space-y-2 rounded-md border p-4">
              <Label htmlFor="teamsWebhookUrl">Teams Webhook 網址</Label>
              <Input
                id="teamsWebhookUrl"
                type="password"
                placeholder={hasTeamsWebhookUrl ? "已設定，留空表示不變更" : "尚未設定"}
                value={form.teamsWebhookUrl}
                onChange={(e) => setForm({ ...form, teamsWebhookUrl: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                在目標頻道設定「傳入 Webhook」連接器取得網址。若貴組織改用較新的 Power Automate 工作流程 Webhook，格式可能不相容。
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleTest} disabled={isTesting || form.channel === "none"}>
              <Send className="mr-2 h-4 w-4" />
              {isTesting ? "發送中..." : "傳送測試通知"}
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "儲存中..." : "儲存設定"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
