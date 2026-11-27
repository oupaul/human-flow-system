import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiFetch } from "@/lib/apiClient";

interface BackupSettings {
  smbEnabled: boolean;
  smbHost: string | null;
  smbShare: string | null;
  smbFolder: string | null;
  smbUsername: string | null;
  smbDomain: string | null;
  hasPassword: boolean;
  remoteKeepDays: number;
  requestedAction: "test" | "backup" | null;
  lastBackupAt: string | null; lastBackupOk: boolean | null; lastBackupMessage: string | null;
  lastUploadAt: string | null; lastUploadOk: boolean | null; lastUploadMessage: string | null;
  lastTestAt: string | null; lastTestOk: boolean | null; lastTestMessage: string | null;
  workerAlive: boolean;
  scheduleTime: string;
  localKeepDays: number;
}

const toForm = (s: BackupSettings) => ({
  smbEnabled: s.smbEnabled,
  smbHost: s.smbHost ?? "",
  smbShare: s.smbShare ?? "",
  smbFolder: s.smbFolder ?? "",
  smbUsername: s.smbUsername ?? "",
  smbDomain: s.smbDomain ?? "",
  smbPassword: "",
  remoteKeepDays: String(s.remoteKeepDays),
});

type Form = ReturnType<typeof toForm>;

// 備份設定：每天自動備份留在主機上，並可複製到 NAS 的 SMB 資料夾
const BackupCard = () => {
  const { t } = useTranslation(["settings", "common"]);
  const [data, setData] = useState<BackupSettings | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (resetForm: boolean) => {
    try {
      const next = await apiFetch<BackupSettings>("/settings/backup");
      setData(next);
      if (resetForm) {
        setForm(toForm(next));
        setDirty(false);
      }
    } catch (error) {
      toast.error(t("common:common.loadFailed"), { description: error instanceof Error ? error.message : undefined });
    }
  }, [t]);

  useEffect(() => { load(true); }, [load]);

  // 測試或備份執行中：定時更新狀態（不蓋掉正在編輯的欄位）
  const pending = !!data?.requestedAction;
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => load(false), 3000);
    return () => clearInterval(timer);
  }, [pending, load]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setDirty(true);
  };

  const save = async () => {
    if (!form) return;
    try {
      setBusy(true);
      await apiFetch("/settings/backup", { method: "PUT", body: JSON.stringify({ ...form, remoteKeepDays: Number(form.remoteKeepDays) }) });
      toast.success(t("settings:backup.saved"));
      await load(true);
    } catch (error) {
      toast.error(t("common:common.operationFailed"), { description: error instanceof Error ? error.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const run = async (action: "test" | "backup") => {
    try {
      setBusy(true);
      await apiFetch("/settings/backup/action", { method: "POST", body: JSON.stringify({ action }) });
      await load(false);
    } catch (error) {
      toast.error(t("common:common.operationFailed"), { description: error instanceof Error ? error.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const status = (label: string, at: string | null, ok: boolean | null, message: string | null) => (
    <div className="flex items-start gap-2 text-sm">
      {ok === null ? <span className="mt-0.5 h-4 w-4 shrink-0" /> : ok
        ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
        : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />}
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <span className="break-all">{at ? `${at} · ${message ?? ""}` : t("settings:backup.never")}</span>
    </div>
  );

  const field = (key: "smbHost" | "smbShare" | "smbFolder" | "smbUsername" | "smbDomain" | "smbPassword" | "remoteKeepDays", label: string, placeholder = "", type = "text") => (
    <div className="space-y-2">
      <Label htmlFor={key}>{label}</Label>
      <Input id={key} type={type} autoComplete={type === "password" ? "new-password" : "off"} value={form?.[key] ?? ""} placeholder={placeholder} onChange={(e) => set(key, e.target.value)} />
    </div>
  );

  const actionDisabled = busy || pending || dirty || !data?.workerAlive;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings:backup.title")}</CardTitle>
        <CardDescription>
          {data ? t("settings:backup.description", { time: data.scheduleTime, days: data.localKeepDays }) : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {data && !data.workerAlive && <p className="text-sm text-red-600">{t("settings:backup.workerDown")}</p>}
        {form && (
          <>
            <div className="flex items-center gap-3">
              <Switch id="smbEnabled" checked={form.smbEnabled} onCheckedChange={(v) => set("smbEnabled", v)} />
              <Label htmlFor="smbEnabled">{t("settings:backup.enable")}</Label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {field("smbHost", t("settings:backup.host"), "192.168.1.10")}
              {field("smbShare", t("settings:backup.share"), "backup")}
              {field("smbFolder", t("settings:backup.folder"), "hrms")}
              {field("smbDomain", t("settings:backup.domain"))}
              {field("smbUsername", t("settings:backup.username"))}
              {field("smbPassword", t("settings:backup.password"), data?.hasPassword ? t("settings:backup.passwordKept") : "", "password")}
              {field("remoteKeepDays", t("settings:backup.remoteKeepDays"), "90", "number")}
            </div>
          </>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={save} disabled={busy || !form || !dirty}>{t("common:actions.save")}</Button>
          <Button variant="outline" onClick={() => run("test")} disabled={actionDisabled || !data?.hasPassword}>{t("settings:backup.test")}</Button>
          <Button variant="outline" onClick={() => run("backup")} disabled={actionDisabled}>{t("settings:backup.runNow")}</Button>
          {pending && <span className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{t("settings:backup.running")}</span>}
          {dirty && !pending && <span className="text-sm text-muted-foreground">{t("settings:backup.saveFirst")}</span>}
        </div>
        {data && (
          <div className="space-y-2 rounded-md border p-3">
            {status(t("settings:backup.lastTest"), data.lastTestAt, data.lastTestOk, data.lastTestMessage)}
            {status(t("settings:backup.lastBackup"), data.lastBackupAt, data.lastBackupOk, data.lastBackupMessage)}
            {status(t("settings:backup.lastUpload"), data.lastUploadAt, data.lastUploadOk, data.lastUploadMessage)}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BackupCard;
