import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Download, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { auditLogApi } from "@/services/auditLogApi";
import { AUDIT_CATEGORIES, AuditFilter, AuditLog } from "@/types/auditLog";

const PAGE_SIZE = 50;
const today = () => new Date().toLocaleDateString("sv-SE");
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toLocaleDateString("sv-SE");

// 系統操作紀錄：誰、什麼時候、從哪個 IP、做了什麼、成功或失敗（只有 admin 看得到）
const AuditLogs = () => {
  const { t } = useTranslation(["audit", "common"]);
  const [draft, setDraft] = useState({ from: daysAgo(6), to: today(), actor: "", category: "all", success: "all", q: "" });
  const [filter, setFilter] = useState<AuditFilter>({ from: daysAgo(6), to: today() });
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [retention, setRetention] = useState(730);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await auditLogApi.list(filter, page, PAGE_SIZE);
      setRows(data.rows);
      setTotal(data.total);
      setRetention(data.retentionDays);
    } catch (error) {
      toast.error(t("common:common.loadFailed"), { description: error instanceof Error ? error.message : undefined });
    } finally {
      setLoading(false);
    }
  }, [filter, page, t]);

  useEffect(() => { load(); }, [load]);

  const search = () => { setPage(1); setFilter({ ...draft }); };
  const exportCsv = async () => {
    try {
      setExporting(true);
      const blob = await auditLogApi.exportCsv(filter);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-logs-${today()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(t("common:common.operationFailed"), { description: error instanceof Error ? error.message : undefined });
    } finally {
      setExporting(false);
    }
  };

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const set = (patch: Partial<typeof draft>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t("audit:title")}</h1>
        <p className="text-sm text-muted-foreground">{t("audit:description", { days: retention })}</p>
      </div>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("audit:filters.title")}</CardTitle>
          <CardDescription>{t("audit:filters.hint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            <Input type="date" value={draft.from} onChange={(e) => set({ from: e.target.value })} aria-label={t("audit:filters.from")} />
            <Input type="date" value={draft.to} onChange={(e) => set({ to: e.target.value })} aria-label={t("audit:filters.to")} />
            <Input placeholder={t("audit:filters.actor")} value={draft.actor} onChange={(e) => set({ actor: e.target.value })} onKeyDown={(e) => e.key === "Enter" && search()} />
            <Select value={draft.category} onValueChange={(v) => set({ category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("audit:filters.allCategories")}</SelectItem>
                {AUDIT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{t(`audit:category.${c}`)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={draft.success} onValueChange={(v) => set({ success: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("audit:filters.allResults")}</SelectItem>
                <SelectItem value="true">{t("audit:result.success")}</SelectItem>
                <SelectItem value="false">{t("audit:result.failed")}</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder={t("audit:filters.keyword")} value={draft.q} onChange={(e) => set({ q: e.target.value })} onKeyDown={(e) => e.key === "Enter" && search()} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={search}><Search className="mr-2 h-4 w-4" />{t("audit:filters.search")}</Button>
            <Button variant="outline" onClick={exportCsv} disabled={exporting || total === 0}><Download className="mr-2 h-4 w-4" />{t("audit:export")}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">{t("audit:columns.time")}</TableHead>
                  <TableHead>{t("audit:columns.actor")}</TableHead>
                  <TableHead>{t("audit:columns.category")}</TableHead>
                  <TableHead>{t("audit:columns.summary")}</TableHead>
                  <TableHead>{t("audit:columns.result")}</TableHead>
                  <TableHead>{t("audit:columns.ip")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">{t("common:common.loading")}</TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">{t("audit:empty")}</TableCell></TableRow>
                ) : rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-xs">{r.createdAt}</TableCell>
                    <TableCell>
                      <div className="text-sm">{r.actorUsername ?? "-"}</div>
                      {r.actorRole && <div className="text-xs text-muted-foreground">{r.actorRole}</div>}
                    </TableCell>
                    <TableCell><Badge variant="outline">{t(`audit:category.${r.category}`)}</Badge></TableCell>
                    <TableCell className="text-sm">{r.summary}</TableCell>
                    <TableCell>
                      {r.success
                        ? <Badge className="bg-emerald-600 hover:bg-emerald-600">{t("audit:result.success")}</Badge>
                        : <Badge variant="destructive">{t("audit:result.failed")}{r.statusCode ? ` ${r.statusCode}` : ""}</Badge>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs">{r.ip ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("audit:total", { count: total })}</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>{t("audit:prev")}</Button>
              <span>{page} / {pages}</span>
              <Button size="sm" variant="outline" disabled={page >= pages || loading} onClick={() => setPage((p) => p + 1)}>{t("audit:next")}</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuditLogs;
