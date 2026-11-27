import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/lib/apiClient";

interface Candidate { employeeId: string; name: string; department: string | null; role: string }
interface ApprovalSettings { generalManagerEmployeeId: string | null; storedEmployeeId: string | null; candidates: Candidate[] }

const NONE = "none";

// 簽核設定：指定最終簽核者。管理員與主管的申請由最終簽核者審核
const ApprovalCard = () => {
  const { t } = useTranslation(["settings", "common"]);
  const [data, setData] = useState<ApprovalSettings | null>(null);
  const [selected, setSelected] = useState(NONE);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const next = await apiFetch<ApprovalSettings>("/settings/approval");
      setData(next);
      setSelected(next.generalManagerEmployeeId ?? NONE);
    } catch (error) {
      toast.error(t("common:common.loadFailed"), { description: error instanceof Error ? error.message : undefined });
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    try {
      setBusy(true);
      await apiFetch("/settings/approval", { method: "PUT", body: JSON.stringify({ generalManagerEmployeeId: selected === NONE ? null : selected }) });
      toast.success(t("settings:approval.saved"));
      await load();
    } catch (error) {
      toast.error(t("common:common.operationFailed"), { description: error instanceof Error ? error.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  // 之前設定的人已離職、停用或失去管理端角色
  const stale = !!data?.storedEmployeeId && !data.generalManagerEmployeeId;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings:approval.title")}</CardTitle>
        <CardDescription>{t("settings:approval.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label>{t("settings:approval.generalManager")}</Label>
          <div className="flex flex-wrap gap-2">
            <Select value={selected} onValueChange={setSelected} disabled={!data}>
              <SelectTrigger className="w-80"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("settings:approval.none")}</SelectItem>
                {data?.candidates.map((c) => (
                  <SelectItem key={c.employeeId} value={c.employeeId}>
                    {c.name}（{c.employeeId}）· {t(`common:role.${c.role}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={save} disabled={busy || !data}>{t("common:actions.save")}</Button>
          </div>
        </div>
        {data && !data.generalManagerEmployeeId && (
          <p className="text-sm text-amber-700">{stale ? t("settings:approval.stale") : t("settings:approval.notSet")}</p>
        )}
      </CardContent>
    </Card>
  );
};

export default ApprovalCard;
