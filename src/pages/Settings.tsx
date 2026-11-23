import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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
import BrandingCard from "@/components/settings/BrandingCard";

const emptyForm: NotificationSettingsFormData = {
  channel: "none",
  smtpHost: "",
  smtpPort: "587",
  smtpSecure: false,
  smtpAllowSelfSignedCert: false,
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
  const { t } = useTranslation(["settings", "common"]);
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
        smtpAllowSelfSignedCert: settings.smtpAllowSelfSignedCert,
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
      toast.error(t("settings:loadErrorTitle"), {
        description: t("common:common.networkErrorHint"),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await notificationSettingsApi.updateSettings(form);
      toast.success(t("settings:saveSuccess"));
      await loadSettings();
    } catch (error) {
      toast.error(t("common:common.saveFailed"), {
        description: error instanceof ApiError ? error.message : t("common:common.networkErrorHint"),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    try {
      await notificationSettingsApi.sendTest();
      toast.success(t("settings:testSuccessTitle"), {
        description: t("settings:testSuccessDescription"),
      });
    } catch (error) {
      toast.error(t("settings:testErrorTitle"), {
        description: error instanceof ApiError ? error.message : t("settings:testErrorFallback"),
      });
    } finally {
      setIsTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">{t("common:common.loading")}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("common:nav.settings")}</h1>

      <BrandingCard />

      <Card>
        <CardHeader>
          <CardTitle>{t("settings:card.title")}</CardTitle>
          <CardDescription>
            {t("settings:card.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="channel">{t("settings:channel.label")}</Label>
            <Select value={form.channel} onValueChange={(value) => setForm({ ...form, channel: value as NotificationSettingsFormData["channel"] })}>
              <SelectTrigger id="channel" className="w-[240px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("settings:channel.none")}</SelectItem>
                <SelectItem value="smtp">{t("settings:channel.smtp")}</SelectItem>
                <SelectItem value="teams">{t("settings:channel.teams")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.channel === "smtp" && (
            <div className="space-y-4 rounded-md border p-4">
              <div className="space-y-2">
                <Label htmlFor="notificationToEmails">{t("settings:smtp.toEmails")}</Label>
                <Input
                  id="notificationToEmails"
                  placeholder="hr@example.com,manager@example.com"
                  value={form.notificationToEmails}
                  onChange={(e) => setForm({ ...form, notificationToEmails: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="smtpHost">{t("settings:smtp.host")}</Label>
                  <Input id="smtpHost" value={form.smtpHost} onChange={(e) => setForm({ ...form, smtpHost: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpPort">{t("settings:smtp.port")}</Label>
                  <Input id="smtpPort" type="number" value={form.smtpPort} onChange={(e) => setForm({ ...form, smtpPort: e.target.value })} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="smtpSecure" checked={form.smtpSecure} onCheckedChange={(checked) => setForm({ ...form, smtpSecure: checked })} />
                <Label htmlFor="smtpSecure">{t("settings:smtp.secure")}</Label>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Switch
                    id="smtpAllowSelfSignedCert"
                    checked={form.smtpAllowSelfSignedCert}
                    onCheckedChange={(checked) => setForm({ ...form, smtpAllowSelfSignedCert: checked })}
                  />
                  <Label htmlFor="smtpAllowSelfSignedCert">{t("settings:smtp.allowSelfSignedCert")}</Label>
                </div>
                <p className="text-xs text-muted-foreground pl-11">{t("settings:smtp.allowSelfSignedCertHint")}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtpFrom">{t("settings:smtp.from")}</Label>
                <Input id="smtpFrom" placeholder="hrms@example.com" value={form.smtpFrom} onChange={(e) => setForm({ ...form, smtpFrom: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtpAuthMethod">{t("settings:smtp.authMethod")}</Label>
                <Select value={form.smtpAuthMethod} onValueChange={(value) => setForm({ ...form, smtpAuthMethod: value as "basic" | "oauth2" })}>
                  <SelectTrigger id="smtpAuthMethod" className="w-[240px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">{t("settings:smtp.authBasic")}</SelectItem>
                    <SelectItem value="oauth2">{t("settings:smtp.authOauth2")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.smtpAuthMethod === "basic" ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="smtpUser">{t("settings:smtp.user")}</Label>
                    <Input id="smtpUser" value={form.smtpUser} onChange={(e) => setForm({ ...form, smtpUser: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtpPassword">{t("settings:smtp.password")}</Label>
                    <Input
                      id="smtpPassword"
                      type="password"
                      placeholder={hasSmtpPassword ? t("common:common.setKeepBlank") : t("common:common.unset")}
                      value={form.smtpPassword}
                      onChange={(e) => setForm({ ...form, smtpPassword: e.target.value })}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="smtpOauthUser">{t("settings:smtp.oauthUser")}</Label>
                    <Input id="smtpOauthUser" value={form.smtpOauthUser} onChange={(e) => setForm({ ...form, smtpOauthUser: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="smtpOauthClientId">{t("settings:smtp.oauthClientId")}</Label>
                      <Input id="smtpOauthClientId" value={form.smtpOauthClientId} onChange={(e) => setForm({ ...form, smtpOauthClientId: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtpOauthClientSecret">{t("settings:smtp.oauthClientSecret")}</Label>
                      <Input
                        id="smtpOauthClientSecret"
                        type="password"
                        placeholder={hasSmtpOauthClientSecret ? t("common:common.setKeepBlank") : t("common:common.unset")}
                        value={form.smtpOauthClientSecret}
                        onChange={(e) => setForm({ ...form, smtpOauthClientSecret: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtpOauthRefreshToken">{t("settings:smtp.oauthRefreshToken")}</Label>
                    <Input
                      id="smtpOauthRefreshToken"
                      type="password"
                      placeholder={hasSmtpOauthRefreshToken ? t("common:common.setKeepBlank") : t("common:common.unset")}
                      value={form.smtpOauthRefreshToken}
                      onChange={(e) => setForm({ ...form, smtpOauthRefreshToken: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("settings:smtp.oauthHelp")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {form.channel === "teams" && (
            <div className="space-y-2 rounded-md border p-4">
              <Label htmlFor="teamsWebhookUrl">{t("settings:teams.webhookUrl")}</Label>
              <Input
                id="teamsWebhookUrl"
                type="password"
                placeholder={hasTeamsWebhookUrl ? t("common:common.setKeepBlank") : t("common:common.unset")}
                value={form.teamsWebhookUrl}
                onChange={(e) => setForm({ ...form, teamsWebhookUrl: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                {t("settings:teams.webhookHelp")}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleTest} disabled={isTesting || form.channel === "none"}>
              <Send className="mr-2 h-4 w-4" />
              {isTesting ? t("settings:actions.sending") : t("common:actions.sendTest")}
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? t("settings:actions.saving") : t("settings:actions.saveSettings")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
