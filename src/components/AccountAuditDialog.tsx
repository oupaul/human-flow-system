import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { accountsApi } from "@/services/accountsApi";
import { AccountAuditLog } from "@/types/accounts";

const PAGE_SIZE = 50;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AccountAuditDialog = ({ open, onOpenChange }: Props) => {
  const { t } = useTranslation(["accounts", "common"]);
  const [rows, setRows] = useState<AccountAuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await accountsApi.audit({ q: q.trim() || undefined, limit: PAGE_SIZE, offset: page * PAGE_SIZE });
      setRows(data.rows);
      setTotal(data.total);
    } catch (error) {
      toast.error(t("common:common.loadFailed"), { description: error instanceof Error ? error.message : undefined });
    } finally {
      setLoading(false);
    }
  }, [q, page, t]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const maxPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
  const roleLabel = (v: string | null) => (v ? t(`common:role.${v}`, { defaultValue: v }) : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("accounts:audit.title")}</DialogTitle>
          <DialogDescription>{t("accounts:audit.description")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-3">
          <Input
            className="w-64"
            placeholder={t("accounts:audit.searchPlaceholder")}
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(0); }}
          />
          <span className="text-sm text-muted-foreground">{t("accounts:audit.total", { count: total })}</span>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("accounts:audit.columns.time")}</TableHead>
                <TableHead>{t("accounts:audit.columns.account")}</TableHead>
                <TableHead>{t("accounts:audit.columns.action")}</TableHead>
                <TableHead>{t("accounts:audit.columns.change")}</TableHead>
                <TableHead>{t("accounts:audit.columns.actor")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="py-8 text-center">{t("common:common.loading")}</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">{t("accounts:audit.empty")}</TableCell></TableRow>
              ) : rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-xs">{r.createdAt}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.targetUsername ?? "—"}</TableCell>
                  <TableCell><Badge variant="outline">{t(`accounts:audit.actions.${r.action}`)}</Badge></TableCell>
                  <TableCell className="text-sm">
                    {r.action === "role_change" ? (
                      <span className="inline-flex flex-wrap items-center gap-1">
                        <span className="text-muted-foreground">{roleLabel(r.beforeValue)}</span>
                        <ArrowRight className="h-3 w-3" />
                        <span className="font-medium">{roleLabel(r.afterValue)}</span>
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs">{r.actorUsername ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-end gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>{t("accounts:audit.prev")}</Button>
            <span className="text-sm text-muted-foreground">{page + 1} / {maxPage + 1}</span>
            <Button size="sm" variant="outline" disabled={page >= maxPage} onClick={() => setPage(page + 1)}>{t("accounts:audit.next")}</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AccountAuditDialog;
