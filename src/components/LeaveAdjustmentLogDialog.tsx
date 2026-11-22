import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { leaveAdjustmentApi } from "@/services/leaveAdjustmentApi";
import { LeaveAdjustmentAction, LeaveAdjustmentLog } from "@/types/leaveAdjustment";

const ACTIONS: LeaveAdjustmentAction[] = [
  "annual_used", "annual_carried_in", "annual_granted", "annual_settle",
  "comp_settle", "sick_balance", "grant_create", "grant_delete",
];
const PAGE_SIZE = 50;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LeaveAdjustmentLogDialog = ({ open, onOpenChange }: Props) => {
  const { t } = useTranslation(["leaveManagement", "common"]);
  const [rows, setRows] = useState<LeaveAdjustmentLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [action, setAction] = useState("all");
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await leaveAdjustmentApi.list({ q: q.trim() || undefined, action, limit: PAGE_SIZE, offset: page * PAGE_SIZE });
      setRows(data.rows);
      setTotal(data.total);
    } catch (error) {
      toast.error(t("common:common.loadFailed"), { description: error instanceof Error ? error.message : undefined });
    } finally {
      setLoading(false);
    }
  }, [q, action, page, t]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const maxPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("leaveManagement:adjustLog.title")}</DialogTitle>
          <DialogDescription>{t("leaveManagement:adjustLog.description")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-3">
          <Input
            className="w-64"
            placeholder={t("leaveManagement:adjustLog.searchPlaceholder")}
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(0); }}
          />
          <Select value={action} onValueChange={(v) => { setAction(v); setPage(0); }}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("leaveManagement:adjustLog.allActions")}</SelectItem>
              {ACTIONS.map((a) => <SelectItem key={a} value={a}>{t(`leaveManagement:adjustLog.actions.${a}`)}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">{t("leaveManagement:adjustLog.total", { count: total })}</span>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("leaveManagement:adjustLog.columns.time")}</TableHead>
                <TableHead>{t("leaveManagement:adjustLog.columns.employee")}</TableHead>
                <TableHead>{t("leaveManagement:adjustLog.columns.action")}</TableHead>
                <TableHead>{t("leaveManagement:adjustLog.columns.change")}</TableHead>
                <TableHead>{t("leaveManagement:adjustLog.columns.detail")}</TableHead>
                <TableHead>{t("leaveManagement:adjustLog.columns.actor")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="py-8 text-center">{t("common:common.loading")}</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">{t("leaveManagement:adjustLog.empty")}</TableCell></TableRow>
              ) : rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-xs">{r.created_at}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.employeeName ?? "—"}（{r.employeeId}）</TableCell>
                  <TableCell><Badge variant="outline">{t(`leaveManagement:adjustLog.actions.${r.action}`)}</Badge></TableCell>
                  <TableCell className="text-sm">
                    <span className="inline-flex flex-wrap items-center gap-1">
                      {r.beforeValue !== null && <span className="text-muted-foreground">{r.beforeValue}</span>}
                      {r.beforeValue !== null && r.afterValue !== null && <ArrowRight className="h-3 w-3" />}
                      {r.afterValue !== null && <span className="font-medium">{r.afterValue}</span>}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[260px] text-xs text-muted-foreground">{r.detail}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs">
                    {r.actorUsername ?? "—"}{r.actorRole ? `（${t(`common:role.${r.actorRole}`)}）` : ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-end gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>{t("leaveManagement:adjustLog.prev")}</Button>
            <span className="text-sm text-muted-foreground">{page + 1} / {maxPage + 1}</span>
            <Button size="sm" variant="outline" disabled={page >= maxPage} onClick={() => setPage(page + 1)}>{t("leaveManagement:adjustLog.next")}</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default LeaveAdjustmentLogDialog;
