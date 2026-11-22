import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { punchRequestApi } from "@/services/punchRequestApi";
import { ComplianceEntry, PunchException } from "@/types/punchRequests";
import { currentMonthStr, toLocalDateStr } from "@/lib/taipeiDate";

const ExceptionsTab = ({ canRun }: { canRun: boolean }) => {
  const { t } = useTranslation(["punch", "common"]);
  const [status, setStatus] = useState<"open" | "all">("open");
  const [rows, setRows] = useState<PunchException[]>([]);
  const [month, setMonth] = useState(currentMonthStr());
  const [compliance, setCompliance] = useState<ComplianceEntry[]>([]);
  const [busy, setBusy] = useState(false);

  const loadExceptions = useCallback(async () => {
    try {
      const from = new Date();
      from.setDate(from.getDate() - 30);
      setRows(await punchRequestApi.getExceptions({ status, from: toLocalDateStr(from) }));
    } catch (error) {
      toast.error(t("common:common.loadFailed"), { description: error instanceof Error ? error.message : undefined });
    }
  }, [status, t]);

  const loadCompliance = useCallback(async () => {
    try {
      setCompliance(await punchRequestApi.getCompliance(month));
    } catch (error) {
      toast.error(t("common:common.loadFailed"), { description: error instanceof Error ? error.message : undefined });
    }
  }, [month, t]);

  useEffect(() => { loadExceptions(); }, [loadExceptions]);
  useEffect(() => { loadCompliance(); }, [loadCompliance]);

  const run = async () => {
    try {
      setBusy(true);
      const result = await punchRequestApi.runDetection();
      toast.success(t("punch:exceptions.runDone", { count: result.detected }));
      await loadExceptions();
    } catch (error) {
      toast.error(t("common:common.operationFailed"), { description: error instanceof Error ? error.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>{t("punch:exceptions.title")}</CardTitle>
            <CardDescription>{t("punch:exceptions.description")}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={status} onValueChange={(v) => setStatus(v as "open" | "all")}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">{t("punch:exceptions.open")}</SelectItem>
                <SelectItem value="all">{t("punch:exceptions.all")}</SelectItem>
              </SelectContent>
            </Select>
            {canRun && <Button variant="outline" onClick={run} disabled={busy}><RefreshCw className="mr-2 h-4 w-4" />{t("punch:exceptions.run")}</Button>}
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common:table.date")}</TableHead>
                  <TableHead>{t("common:table.name")}</TableHead>
                  <TableHead>{t("punch:exceptions.kind")}</TableHead>
                  <TableHead>{t("common:table.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">{t("punch:exceptions.empty")}</TableCell></TableRow>
                ) : rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.workDate}</TableCell>
                    <TableCell>{r.employeeName}（{r.employeeId}）<span className="ml-1 text-xs text-muted-foreground">{r.department}</span></TableCell>
                    <TableCell>{t(`punch:exceptions.kinds.${r.resolved ? r.kind : (r.currentKind ?? r.kind)}`)}</TableCell>
                    <TableCell>
                      {r.resolved
                        ? <Badge variant="secondary">{t(`punch:exceptions.resolvedBy.${r.resolvedBy ?? "punched"}`)}</Badge>
                        : <><Badge variant="destructive">{t("punch:exceptions.pending")}</Badge>{r.hasPendingRequest && <Badge variant="outline" className="ml-2">{t("punch:exceptions.requestFiled")}</Badge>}</>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5" />{t("punch:compliance.title")}</CardTitle>
            <CardDescription>{t("punch:compliance.description")}</CardDescription>
          </div>
          <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="h-10 rounded-md border bg-white px-3 text-sm" />
        </CardHeader>
        <CardContent>
          {compliance.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{t("punch:compliance.empty")}</p>
          ) : (
            <div className="space-y-3">
              {compliance.map((c) => (
                <div key={c.employeeId} className="rounded-md border p-3">
                  <div className="mb-1 font-medium">{c.name}（{c.employeeId}）<span className="ml-1 text-xs text-muted-foreground">{c.department}</span></div>
                  <ul className="space-y-1 text-sm">
                    {c.issues.map((i, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Badge variant="outline" className="shrink-0">{t(`punch:compliance.types.${i.type}`)}</Badge>
                        <span className="text-muted-foreground">{i.detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ExceptionsTab;
