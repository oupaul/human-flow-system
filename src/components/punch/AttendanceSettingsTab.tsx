import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { punchApi } from "@/services/punchApi";
import { departmentApi } from "@/services/departmentApi";
import { AttendanceSettings } from "@/types/punch";

const AttendanceSettingsTab = () => {
  const { t } = useTranslation(["punch", "common"]);
  const [settings, setSettings] = useState<AttendanceSettings | null>(null);
  const [departments, setDepartments] = useState<string[]>([]);
  const [dept, setDept] = useState("");
  const [source, setSource] = useState<"import" | "system">("system");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setSettings(await punchApi.getSettings());
      const list = await departmentApi.getDepartments();
      setDepartments(list.map((d) => d.name));
    } catch (error) {
      toast.error(t("common:common.loadFailed"), { description: error instanceof Error ? error.message : undefined });
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  if (!settings) return null;

  const save = async () => {
    try {
      setBusy(true);
      const { yourIp: _ignored, ...data } = settings;
      const result = await punchApi.saveSettings(data);
      toast.success(result.message);
      await load();
    } catch (error) {
      toast.error(t("common:common.saveFailed"), { description: error instanceof Error ? error.message : undefined, duration: 10000 });
    } finally {
      setBusy(false);
    }
  };

  const addMyIp = () => {
    if (!settings.yourIp) return;
    const lines = settings.ipAllowlist.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.includes(settings.yourIp)) setSettings({ ...settings, ipAllowlist: [...lines, settings.yourIp].join("\n") });
  };

  const applySource = async () => {
    if (!dept) return;
    try {
      setBusy(true);
      const result = await punchApi.setSource({ source, department: dept });
      toast.success(t("punch:settings.sourceApplied", { count: result.updated }));
    } catch (error) {
      toast.error(t("common:common.operationFailed"), { description: error instanceof Error ? error.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("punch:settings.networkTitle")}</CardTitle>
            <CardDescription>{t("punch:settings.networkHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea rows={5} value={settings.ipAllowlist} onChange={(e) => setSettings({ ...settings, ipAllowlist: e.target.value })} placeholder={"203.0.113.5\n203.0.113.0/24"} />
            <div className="flex items-center gap-3 text-sm">
              <Button type="button" variant="outline" size="sm" onClick={addMyIp}>{t("punch:settings.addMyIp")}</Button>
              <span className="text-muted-foreground">{t("punch:settings.yourIp", { ip: settings.yourIp ?? "—" })}</span>
            </div>
            <p className="text-xs text-muted-foreground">{t("punch:settings.networkNote")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("punch:settings.deviceTitle")}</CardTitle>
            <CardDescription>{t("punch:settings.deviceHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>{t("punch:settings.bindingMode")}</Label>
              <Select value={settings.deviceBinding} onValueChange={(v) => setSettings({ ...settings, deviceBinding: v as AttendanceSettings["deviceBinding"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="enforce">{t("punch:settings.modeEnforce")}</SelectItem>
                  <SelectItem value="flag">{t("punch:settings.modeFlag")}</SelectItem>
                  <SelectItem value="off">{t("punch:settings.modeOff")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t("punch:settings.maxDevices")}</Label>
              <Input type="number" min={1} max={10} value={settings.maxDevicesPerEmployee} onChange={(e) => setSettings({ ...settings, maxDevicesPerEmployee: Number(e.target.value) })} />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label>{t("punch:settings.autoApprove")}</Label>
                <p className="text-xs text-muted-foreground">{t("punch:settings.autoApproveHint")}</p>
              </div>
              <Switch checked={settings.autoApproveFirstDevice} onCheckedChange={(v) => setSettings({ ...settings, autoApproveFirstDevice: v })} />
            </div>
            <p className="text-xs text-muted-foreground">{t("punch:settings.macNote")}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("punch:settings.shiftTitle")}</CardTitle>
          <CardDescription>{t("punch:settings.shiftHint")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-1"><Label>{t("punch:settings.shiftStart")}</Label><Input type="time" value={settings.defaultShiftStart} onChange={(e) => setSettings({ ...settings, defaultShiftStart: e.target.value })} /></div>
          <div className="space-y-1"><Label>{t("punch:settings.shiftEnd")}</Label><Input type="time" value={settings.defaultShiftEnd} onChange={(e) => setSettings({ ...settings, defaultShiftEnd: e.target.value })} /></div>
        </CardContent>
      </Card>

      <Button onClick={save} disabled={busy}>{t("common:actions.save")}</Button>

      <Card>
        <CardHeader>
          <CardTitle>{t("punch:settings.sourceTitle")}</CardTitle>
          <CardDescription>{t("punch:settings.sourceHint")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label>{t("common:table.department")}</Label>
            <Select value={dept} onValueChange={setDept}>
              <SelectTrigger className="w-48"><SelectValue placeholder={t("punch:settings.selectDept")} /></SelectTrigger>
              <SelectContent>{departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{t("punch:settings.source")}</Label>
            <Select value={source} onValueChange={(v) => setSource(v as "import" | "system")}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="system">{t("punch:sourceMode.system")}</SelectItem>
                <SelectItem value="import">{t("punch:sourceMode.import")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" disabled={!dept || busy} onClick={applySource}>{t("punch:settings.apply")}</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AttendanceSettingsTab;
