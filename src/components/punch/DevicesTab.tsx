import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { punchApi } from "@/services/punchApi";
import { PunchDevice } from "@/types/punch";

const DevicesTab = () => {
  const { t } = useTranslation(["punch", "common"]);
  const [devices, setDevices] = useState<PunchDevice[]>([]);

  const load = useCallback(async () => {
    try {
      setDevices(await punchApi.getDevices());
    } catch (error) {
      toast.error(t("common:common.loadFailed"), { description: error instanceof Error ? error.message : undefined });
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const act = async (id: number, action: "approve" | "revoke") => {
    try {
      const result = await punchApi.setDevice(id, action);
      toast.success(result.message);
      await load();
    } catch (error) {
      toast.error(t("common:common.operationFailed"), { description: error instanceof Error ? error.message : undefined });
    }
  };

  const variant = (s: PunchDevice["status"]) => (s === "approved" ? "secondary" : s === "pending" ? "default" : "outline");

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t("punch:devices.hint")}</p>
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common:table.name")}</TableHead>
              <TableHead>{t("punch:devices.label")}</TableHead>
              <TableHead>{t("common:table.status")}</TableHead>
              <TableHead>{t("punch:devices.firstSeen")}</TableHead>
              <TableHead>{t("punch:devices.lastSeen")}</TableHead>
              <TableHead>{t("punch:devices.approvedBy")}</TableHead>
              <TableHead className="text-right">{t("common:table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {devices.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">{t("punch:devices.empty")}</TableCell></TableRow>
            ) : devices.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="whitespace-nowrap">{d.employeeName ?? "—"}（{d.employeeId}）</TableCell>
                <TableCell>{d.label ?? "—"}</TableCell>
                <TableCell><Badge variant={variant(d.status)}>{t(`punch:devices.status.${d.status}`)}</Badge></TableCell>
                <TableCell className="whitespace-nowrap text-xs">{d.firstSeenAt}</TableCell>
                <TableCell className="whitespace-nowrap text-xs">{d.lastSeenAt}<br /><span className="text-muted-foreground">{d.lastIp}</span></TableCell>
                <TableCell className="text-xs">{d.approvedBy ?? "—"}</TableCell>
                <TableCell className="space-x-2 text-right">
                  {d.status !== "approved" && <Button size="sm" onClick={() => act(d.id, "approve")}>{t("punch:devices.approve")}</Button>}
                  {d.status !== "revoked" && <Button size="sm" variant="outline" onClick={() => act(d.id, "revoke")}>{t("punch:devices.revoke")}</Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default DevicesTab;
