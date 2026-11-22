import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Download, Lock, LockOpen, RefreshCw, Trash2, Upload, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { payrollApi } from "@/services/payrollApi";
import PayrollRulesPanel from "@/components/PayrollRulesPanel";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BracketSet, InsuranceRate, LeaveDetailLine, OvertimeDetailLine, PayrollItem, PayrollSnapshotDetail, PayrollSnapshotSummary } from "@/types/payroll";

const RATE_KEYS = [
  "laborRate", "laborEmployeeShare", "laborEmployerShare", "laborEmployerOnlyRate",
  "healthRate", "healthEmployeeShare", "healthEmployerShare", "healthAvgDependents", "healthDependentCap",
  "pensionEmployerRate",
] as const;

const errorDescription = (error: unknown) => (error instanceof Error ? error.message : undefined);
const money = (v: number | null | undefined) => (v === null || v === undefined ? "—" : Number(v).toLocaleString());
const currentMonth = () => new Date().toISOString().slice(0, 7);

const downloadText = (filename: string, text: string) => {
  const url = URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

const Payroll = () => {
  const { t } = useTranslation(["payroll", "common"]);
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab = tabParam === "rates" || tabParam === "rules" ? tabParam : "snapshots";

  const [snapshots, setSnapshots] = useState<PayrollSnapshotSummary[]>([]);
  const [detail, setDetail] = useState<PayrollSnapshotDetail | null>(null);
  const [month, setMonth] = useState(currentMonth());
  const [detailItem, setDetailItem] = useState<PayrollItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<{ kind: "lock" | "unlock" | "delete" | "regenerate"; month: string } | null>(null);

  const [rates, setRates] = useState<InsuranceRate[]>([]);
  const [brackets, setBrackets] = useState<BracketSet[]>([]);
  const [ratesCsv, setRatesCsv] = useState("");
  const [bracketsCsv, setBracketsCsv] = useState("");

  const loadSnapshots = useCallback(async () => {
    try {
      setSnapshots(await payrollApi.listSnapshots());
    } catch (error) {
      toast.error(t("common:common.loadFailed"), { description: errorDescription(error) });
    }
  }, [t]);

  const loadRates = useCallback(async () => {
    try {
      const data = await payrollApi.getRates();
      setRates(data.rates);
      setBrackets(data.brackets);
    } catch (error) {
      toast.error(t("common:common.loadFailed"), { description: errorDescription(error) });
    }
  }, [t]);

  useEffect(() => { loadSnapshots(); loadRates(); }, [loadSnapshots, loadRates]);

  const openDetail = async (m: string) => {
    try {
      setDetail(await payrollApi.getSnapshot(m));
    } catch (error) {
      toast.error(t("common:common.loadFailed"), { description: errorDescription(error) });
    }
  };

  const run = async (action: () => Promise<{ message?: string }>, failTitle: string, after?: () => Promise<void> | void) => {
    try {
      setBusy(true);
      const result = await action();
      toast.success(result.message ?? t("common:common.saveSuccess"));
      await after?.();
    } catch (error) {
      toast.error(failTitle, { description: errorDescription(error) });
    } finally {
      setBusy(false);
    }
  };

  const generate = (m: string) =>
    run(() => payrollApi.generate(m), t("payroll:snapshots.generateFailed"), async () => {
      await loadSnapshots();
      await openDetail(m);
    });

  const handleGenerateClick = () => {
    const existing = snapshots.find((s) => s.month === month);
    if (existing?.status === "locked") {
      toast.error(t("payroll:snapshots.lockedCannotRegenerate"));
    } else if (existing) {
      setConfirm({ kind: "regenerate", month });
    } else {
      generate(month);
    }
  };

  const handleConfirm = async () => {
    if (!confirm) return;
    const { kind, month: m } = confirm;
    setConfirm(null);
    if (kind === "regenerate") return generate(m);
    const action = kind === "lock" ? () => payrollApi.lock(m) : kind === "unlock" ? () => payrollApi.unlock(m) : () => payrollApi.remove(m);
    await run(action, t("common:common.operationFailed"), async () => {
      await loadSnapshots();
      if (kind === "delete") setDetail(null);
      else if (detail?.month === m) await openDetail(m);
    });
  };

  const exportXlsx = async (m: string) => {
    try {
      const blob = await payrollApi.exportXlsx(m);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `payroll-${m}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(t("common:common.operationFailed"), { description: errorDescription(error) });
    }
  };

  const importCsv = (kind: "rates" | "brackets") => {
    const csv = kind === "rates" ? ratesCsv : bracketsCsv;
    run(
      () => (kind === "rates" ? payrollApi.importRates(csv) : payrollApi.importBrackets(csv)),
      t("payroll:rates.importFailed"),
      async () => { (kind === "rates" ? setRatesCsv : setBracketsCsv)(""); await loadRates(); }
    );
  };

  const rateTemplate = () => downloadText(
    "insurance-rates-template.csv",
    "effectiveDate,key,value,note\n" + RATE_KEYS.map((k) => `2026-01-01,${k},,${t(`payroll:rateKeys.${k}`).replace(/,/g, "，")}`).join("\n") + "\n"
  );
  const bracketTemplate = () => downloadText(
    "insurance-brackets-template.csv",
    "effectiveDate,type,amount\n2026-01-01,labor,\n2026-01-01,health,\n2026-01-01,pension,\n"
  );

  const statusBadge = (s: PayrollSnapshotSummary["status"]) =>
    <Badge variant={s === "locked" ? "default" : "outline"}>{t(`payroll:status.${s}`)}</Badge>;

  const ratesByDate = rates.reduce<Record<string, InsuranceRate[]>>((acc, r) => {
    (acc[r.effectiveDate] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("common:nav.payroll")}</h1>
        <p className="text-sm text-muted-foreground">{t("payroll:disclaimer")}</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setSearchParams(v === "snapshots" ? {} : { tab: v })}>
        <TabsList>
          <TabsTrigger value="snapshots">{t("payroll:tabs.snapshots")}</TabsTrigger>
          <TabsTrigger value="rules">{t("payroll:tabs.rules")}</TabsTrigger>
          <TabsTrigger value="rates">{t("payroll:tabs.rates")}</TabsTrigger>
        </TabsList>

        <TabsContent value="snapshots" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("payroll:snapshots.generateTitle")}</CardTitle>
              <CardDescription>{t("payroll:snapshots.generateHint")}</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-3">
              <Input type="month" value={month} max={currentMonth()} onChange={(e) => setMonth(e.target.value)} className="w-48" />
              <Button onClick={handleGenerateClick} disabled={busy || !month} className="bg-hrms-accent">
                <RefreshCw className="mr-2 h-4 w-4" /> {t("payroll:snapshots.generate")}
              </Button>
            </CardContent>
          </Card>

          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("payroll:snapshots.month")}</TableHead>
                  <TableHead>{t("common:table.status")}</TableHead>
                  <TableHead>{t("payroll:snapshots.headcount")}</TableHead>
                  <TableHead>{t("payroll:snapshots.period")}</TableHead>
                  <TableHead>{t("payroll:snapshots.salary")}</TableHead>
                  <TableHead>{t("payroll:snapshots.overtimePay")}</TableHead>
                  <TableHead>{t("payroll:snapshots.leaveDeduction")}</TableHead>
                  <TableHead>{t("payroll:snapshots.net")}</TableHead>
                  <TableHead>{t("payroll:snapshots.totalCost")}</TableHead>
                  <TableHead className="text-right">{t("common:table.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshots.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="py-8 text-center text-muted-foreground">{t("payroll:snapshots.empty")}</TableCell></TableRow>
                ) : snapshots.map((s) => (
                  <TableRow key={s.id} className={detail?.month === s.month ? "bg-muted/40" : ""}>
                    <TableCell className="font-medium">{s.month}</TableCell>
                    <TableCell>{statusBadge(s.status)}</TableCell>
                    <TableCell>{s.headcount}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{s.periodStart && s.periodEnd ? `${s.periodStart.slice(5)} ~ ${s.periodEnd.slice(5)}` : "—"}</TableCell>
                    <TableCell>{money(s.salary)}</TableCell>
                    <TableCell>{money(s.overtimePay)}</TableCell>
                    <TableCell>{money(s.leaveDeduction)}</TableCell>
                    <TableCell>{money(s.netTotal)}</TableCell>
                    <TableCell className="font-medium">{money(s.totalCost)}</TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button size="sm" onClick={() => openDetail(s.month)}>{t("common:actions.view")}</Button>
                      <Button size="sm" variant="outline" onClick={() => exportXlsx(s.month)}><Download className="mr-1 h-4 w-4" />Excel</Button>
                      {s.status === "draft" ? (
                        <>
                          <Button size="sm" variant="outline" onClick={() => setConfirm({ kind: "lock", month: s.month })}><Lock className="mr-1 h-4 w-4" />{t("payroll:snapshots.lock")}</Button>
                          <Button size="sm" variant="outline" onClick={() => setConfirm({ kind: "delete", month: s.month })}><Trash2 className="h-4 w-4" /></Button>
                        </>
                      ) : user?.role === "admin" ? (
                        <Button size="sm" variant="outline" onClick={() => setConfirm({ kind: "unlock", month: s.month })}><LockOpen className="mr-1 h-4 w-4" />{t("payroll:snapshots.unlock")}</Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {detail && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <CardTitle>{t("payroll:detail.title", { month: detail.month })}</CardTitle>
                  {statusBadge(detail.status)}
                </div>
                <CardDescription>
                  {detail.periodStart && detail.periodEnd && `${t("payroll:detail.period", { start: detail.periodStart, end: detail.periodEnd })} · `}
                  {t("payroll:detail.meta", { by: detail.generatedBy ?? "—", at: detail.generatedAt ?? "—" })}
                  {detail.status === "locked" && ` · ${t("payroll:detail.lockedMeta", { by: detail.lockedBy ?? "—", at: detail.lockedAt ?? "—" })}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {([["salary", detail.totals.salary], ["overtimePay", detail.totals.overtimePay], ["leaveDeduction", detail.totals.leaveDeduction], ["gross", detail.totals.gross],
                    ["employee", detail.totals.employee], ["net", detail.totals.net], ["employer", detail.totals.employer], ["totalCost", detail.totals.totalCost]] as const).map(([k, v]) => (
                    <div key={k} className="rounded-md border p-3">
                      <p className="text-xs text-muted-foreground">{t(`payroll:snapshots.${k}`)}</p>
                      <p className="text-lg font-semibold">NT$ {money(v)}</p>
                    </div>
                  ))}
                </div>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("common:table.name")}</TableHead>
                        <TableHead>{t("payroll:detail.salary")}</TableHead>
                        <TableHead>{t("payroll:detail.overtime")}</TableHead>
                        <TableHead>{t("payroll:detail.leave")}</TableHead>
                        <TableHead>{t("payroll:snapshots.gross")}</TableHead>
                        <TableHead>{t("payroll:detail.labor")}</TableHead>
                        <TableHead>{t("payroll:detail.health")}</TableHead>
                        <TableHead>{t("payroll:detail.pension")}</TableHead>
                        <TableHead>{t("payroll:snapshots.net")}</TableHead>
                        <TableHead>{t("payroll:snapshots.employer")}</TableHead>
                        <TableHead>{t("payroll:detail.warnings")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.items.map((i) => (
                        <TableRow key={i.id}>
                          <TableCell className="whitespace-nowrap">{i.employeeName}（{i.employeeId}）</TableCell>
                          <TableCell>{money(i.monthlySalary)}</TableCell>
                          <TableCell className="whitespace-nowrap text-xs">
                            {i.overtimePay === null ? "—" : <>{money(i.overtimePay)}<span className="text-muted-foreground"> ({i.overtimeHours}h)</span></>}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs">
                            {i.leaveDeduction === null ? "—" : <>{i.leaveDeduction > 0 ? "-" : ""}{money(i.leaveDeduction)}<span className="text-muted-foreground"> ({i.leaveDays}{t("common:table.days")})</span></>}
                          </TableCell>
                          <TableCell className="font-medium">{money(i.grossPay)}</TableCell>
                          <TableCell className="whitespace-nowrap text-xs">{money(i.laborEmployee)} / {money(i.laborEmployer)}</TableCell>
                          <TableCell className="whitespace-nowrap text-xs">{money(i.healthEmployee)} / {money(i.healthEmployer)}</TableCell>
                          <TableCell className="whitespace-nowrap text-xs">{money(i.pensionEmployee)} / {money(i.pensionEmployer)}</TableCell>
                          <TableCell className="font-medium">{money(i.netPay)}</TableCell>
                          <TableCell>{money(i.employerInsurance)}</TableCell>
                          <TableCell className="min-w-[220px] text-xs text-amber-700">
                            {i.variableDetail && <Button size="sm" variant="outline" className="mb-1 h-6 px-2 text-xs" onClick={() => setDetailItem(i)}>{t("payroll:detail.viewLines")}</Button>}
                            {i.warnings && <span className="flex gap-1"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />{i.warnings}</span>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-xs text-muted-foreground">{t("payroll:detail.columnsHint")}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="rules">
          <PayrollRulesPanel />
        </TabsContent>

        <TabsContent value="rates" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t("payroll:rates.ratesTitle")}</CardTitle>
                <CardDescription>{t("payroll:rates.ratesHint")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea rows={8} value={ratesCsv} onChange={(e) => setRatesCsv(e.target.value)} placeholder="effectiveDate,key,value,note&#10;2026-01-01,laborRate,..." />
                <div className="flex gap-2">
                  <Button onClick={() => importCsv("rates")} disabled={busy || !ratesCsv.trim()}><Upload className="mr-2 h-4 w-4" />{t("payroll:rates.import")}</Button>
                  <Button variant="outline" onClick={rateTemplate}><Download className="mr-2 h-4 w-4" />{t("payroll:rates.template")}</Button>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{t("payroll:rates.bracketsTitle")}</CardTitle>
                <CardDescription>{t("payroll:rates.bracketsHint")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea rows={8} value={bracketsCsv} onChange={(e) => setBracketsCsv(e.target.value)} placeholder="effectiveDate,type,amount&#10;2026-01-01,labor,..." />
                <div className="flex gap-2">
                  <Button onClick={() => importCsv("brackets")} disabled={busy || !bracketsCsv.trim()}><Upload className="mr-2 h-4 w-4" />{t("payroll:rates.import")}</Button>
                  <Button variant="outline" onClick={bracketTemplate}><Download className="mr-2 h-4 w-4" />{t("payroll:rates.template")}</Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t("payroll:rates.currentTitle")}</CardTitle>
              <CardDescription>{t("payroll:rates.currentHint")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.keys(ratesByDate).length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("payroll:rates.noRates")}</p>
              ) : Object.entries(ratesByDate).map(([date, list]) => (
                <div key={date}>
                  <h4 className="mb-1 text-sm font-semibold">{t("payroll:rates.effectiveFrom", { date })}</h4>
                  <div className="rounded-md border">
                    <Table>
                      <TableBody>
                        {list.map((r) => (
                          <TableRow key={r.rateKey}>
                            <TableCell>{t(`payroll:rateKeys.${r.rateKey}`, { defaultValue: r.label })}</TableCell>
                            <TableCell className="w-32 text-right font-medium">{r.value}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
              {brackets.length > 0 && (
                <div>
                  <h4 className="mb-1 text-sm font-semibold">{t("payroll:rates.bracketSets")}</h4>
                  <div className="rounded-md border">
                    <Table>
                      <TableBody>
                        {brackets.map((b) => (
                          <TableRow key={`${b.effectiveDate}-${b.bracketType}`}>
                            <TableCell>{b.effectiveDate}</TableCell>
                            <TableCell>{t(`payroll:bracketTypes.${b.bracketType}`)}</TableCell>
                            <TableCell>{t("payroll:rates.bracketSummary", { count: b.count, min: money(b.minAmount), max: money(b.maxAmount) })}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!detailItem} onOpenChange={(open) => !open && setDetailItem(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailItem?.employeeName}（{detailItem?.employeeId}）</DialogTitle>
            <DialogDescription>
              {detail?.periodStart && detail?.periodEnd ? t("payroll:detail.period", { start: detail.periodStart, end: detail.periodEnd }) : ""}
            </DialogDescription>
          </DialogHeader>
          {detailItem?.variableDetail && (() => {
            const lines = JSON.parse(detailItem.variableDetail) as { overtime: OvertimeDetailLine[]; leave: LeaveDetailLine[] };
            return (
              <div className="space-y-4">
                <div>
                  <h4 className="mb-1 text-sm font-semibold">{t("payroll:detail.overtimeLines")}</h4>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("common:table.date")}</TableHead>
                          <TableHead>{t("payroll:detail.dayType")}</TableHead>
                          <TableHead>{t("common:table.hours")}</TableHead>
                          <TableHead>{t("payroll:detail.factor")}</TableHead>
                          <TableHead className="text-right">{t("payroll:detail.amount")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lines.overtime.length === 0 ? (
                          <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{t("common:common.none")}</TableCell></TableRow>
                        ) : lines.overtime.map((o) => (
                          <TableRow key={o.id}>
                            <TableCell>{o.date}</TableCell>
                            <TableCell>{t(`payroll:dayTypes.${o.dayType}`)}</TableCell>
                            <TableCell>{o.hours}</TableCell>
                            <TableCell>{o.factor}</TableCell>
                            <TableCell className="text-right">{money(o.amount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                <div>
                  <h4 className="mb-1 text-sm font-semibold">{t("payroll:detail.leaveLines")}</h4>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("common:table.date")}</TableHead>
                          <TableHead>{t("payroll:detail.leaveType")}</TableHead>
                          <TableHead>{t("common:table.days")}</TableHead>
                          <TableHead>{t("payroll:detail.ratio")}</TableHead>
                          <TableHead className="text-right">{t("payroll:detail.amount")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lines.leave.length === 0 ? (
                          <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{t("common:common.none")}</TableCell></TableRow>
                        ) : lines.leave.map((l) => (
                          <TableRow key={l.id}>
                            <TableCell>{l.date}{l.endDate !== l.date ? ` ~ ${l.endDate}` : ""}</TableCell>
                            <TableCell>{l.leaveType}</TableCell>
                            <TableCell>{l.days}</TableCell>
                            <TableCell>{l.ratio}</TableCell>
                            <TableCell className="text-right">{l.amount > 0 ? "-" : ""}{money(l.amount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm ? t(`payroll:confirm.${confirm.kind}Title`, { month: confirm.month }) : ""}</AlertDialogTitle>
            <AlertDialogDescription>{confirm ? t(`payroll:confirm.${confirm.kind}Body`) : ""}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common:actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>{t("common:actions.confirm")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Payroll;
