import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { punchApi } from "@/services/punchApi";
import { TodayRow } from "@/types/punch";

const TodayTab = () => {
  const { t } = useTranslation(["punch", "common"]);
  const [rows, setRows] = useState<TodayRow[]>([]);
  const [meta, setMeta] = useState<{ date: string; shiftStart: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await punchApi.getToday();
      setRows(data.rows);
      setMeta({ date: data.date, shiftStart: data.shiftStart });
    } catch (error) {
      toast.error(t("common:common.loadFailed"), { description: error instanceof Error ? error.message : undefined });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const punched = rows.filter((r) => r.clockIn).length;
  const stateOf = (r: TodayRow) => {
    if (!r.clockIn) return <Badge variant="outline">{t("punch:today.notYet")}</Badge>;
    if (!r.clockOut) return <Badge>{t("punch:today.working")}</Badge>;
    return <Badge variant="secondary">{t("punch:today.done")}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {meta && t("punch:today.summary", { date: meta.date, shift: meta.shiftStart, punched, total: rows.length })}
        </p>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="mr-2 h-4 w-4" />{t("punch:refresh")}</Button>
      </div>
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common:table.name")}</TableHead>
              <TableHead>{t("common:table.department")}</TableHead>
              <TableHead>{t("punch:today.clockIn")}</TableHead>
              <TableHead>{t("punch:today.clockOut")}</TableHead>
              <TableHead>{t("common:table.status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="py-8 text-center">{t("common:common.loading")}</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">{t("punch:today.empty")}</TableCell></TableRow>
            ) : rows.map((r) => (
              <TableRow key={r.employeeId}>
                <TableCell>{r.name}（{r.employeeId}）</TableCell>
                <TableCell>{r.department}</TableCell>
                <TableCell>
                  {r.clockIn ?? "—"}
                  {r.late && <Badge variant="destructive" className="ml-2">{t("punch:today.late")}</Badge>}
                </TableCell>
                <TableCell>{r.clockOut ?? "—"}</TableCell>
                <TableCell>{stateOf(r)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default TodayTab;
