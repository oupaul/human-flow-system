import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Download, Upload, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { payrollApi } from "@/services/payrollApi";
import { AllowanceRule, LeaveDeduction, OvertimeRule, PayrollSettings } from "@/types/payroll";

const errorDescription = (error: unknown) => (error instanceof Error ? error.message : undefined);

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
const emptyAllowance = { name: "", weekdays: [6, 7] as number[], includeNationalHolidays: true, amount: "", requireAttendance: true, active: true, notes: "" };

const PayrollRulesPanel = () => {
  const { t } = useTranslation(["payroll", "common"]);
  const [settings, setSettings] = useState<PayrollSettings>({ cutoffDay: 25, daysPerMonth: 30, hoursPerDay: 8, defaultScheduleMode: "fixed" });
  const [rules, setRules] = useState<OvertimeRule[]>([]);
  const [deductions, setDeductions] = useState<LeaveDeduction[]>([]);
  const [ratioInputs, setRatioInputs] = useState<Record<number, string>>({});
  const [csv, setCsv] = useState("");
  const [allowances, setAllowances] = useState<AllowanceRule[]>([]);
  const [allowanceOpen, setAllowanceOpen] = useState(false);
  const [editingAllowance, setEditingAllowance] = useState<AllowanceRule | null>(null);
  const [allowanceForm, setAllowanceForm] = useState(emptyAllowance);
  const [deletingAllowance, setDeletingAllowance] = useState<AllowanceRule | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await payrollApi.getRules();
      setSettings(data.settings);
      setRules(data.overtimeRules);
      setDeductions(data.leaveDeductions);
      setAllowances(data.allowanceRules);
      setRatioInputs(Object.fromEntries(data.leaveDeductions.map((d) => [d.leaveTypeId, d.deductRatio === null ? "" : String(d.deductRatio)])));
    } catch (error) {
      toast.error(t("common:common.loadFailed"), { description: errorDescription(error) });
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const run = async (action: () => Promise<{ message: string }>, failTitle: string, after?: () => void) => {
    try {
      setBusy(true);
      const result = await action();
      toast.success(result.message);
      after?.();
      await load();
    } catch (error) {
      toast.error(failTitle, { description: errorDescription(error) });
    } finally {
      setBusy(false);
    }
  };

  const saveDeductions = () => {
    const items = deductions
      .filter((d) => ratioInputs[d.leaveTypeId] !== "" && ratioInputs[d.leaveTypeId] !== undefined)
      .map((d) => ({ leaveTypeId: d.leaveTypeId, deductRatio: Number(ratioInputs[d.leaveTypeId]) }));
    run(() => payrollApi.saveLeaveDeductions(items), t("common:common.saveFailed"));
  };

  const downloadTemplate = () => {
    const text = "dayType,fromHours,toHours,multiplier\nweekday,0,2,\nweekday,2,,\nrest_day,0,,\nholiday,0,,\n";
    const url = URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = "overtime-rules-template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const openAllowance = (rule: AllowanceRule | null) => {
    setEditingAllowance(rule);
    setAllowanceForm(rule ? {
      name: rule.name, weekdays: rule.weekdays, includeNationalHolidays: rule.includeNationalHolidays,
      amount: String(rule.amount), requireAttendance: rule.requireAttendance, active: rule.active, notes: rule.notes ?? "",
    } : emptyAllowance);
    setAllowanceOpen(true);
  };

  const saveAllowance = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name: allowanceForm.name.trim(), weekdays: allowanceForm.weekdays, includeNationalHolidays: allowanceForm.includeNationalHolidays,
      amount: Number(allowanceForm.amount), requireAttendance: allowanceForm.requireAttendance, active: allowanceForm.active,
      notes: allowanceForm.notes.trim() || null,
    };
    run(() => (editingAllowance ? payrollApi.updateAllowanceRule(editingAllowance.id, data) : payrollApi.createAllowanceRule(data)),
      t("common:common.saveFailed"), () => setAllowanceOpen(false));
  };

  const toggleWeekday = (day: number) =>
    setAllowanceForm((f) => ({ ...f, weekdays: f.weekdays.includes(day) ? f.weekdays.filter((d) => d !== day) : [...f.weekdays, day].sort() }));

  const weekdayLabel = (r: AllowanceRule) =>
    [...r.weekdays.map((d) => t(`payroll:weekdays.${d}`)), ...(r.includeNationalHolidays ? [t("payroll:rules.nationalHoliday")] : [])].join("、");

  const rangeLabel = (r: OvertimeRule) => (r.toHours === null ? t("payroll:rules.rangeOpen", { from: r.fromHours }) : t("payroll:rules.range", { from: r.fromHours, to: r.toHours }));
  const unsetCount = deductions.filter((d) => d.deductRatio === null).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("payroll:rules.settingsTitle")}</CardTitle>
          <CardDescription>{t("payroll:rules.settingsHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-4 md:max-w-xl">
            <div className="space-y-1">
              <Label>{t("payroll:rules.cutoffDay")}</Label>
              <Input type="number" min={1} max={28} value={settings.cutoffDay} onChange={(e) => setSettings({ ...settings, cutoffDay: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label>{t("payroll:rules.daysPerMonth")}</Label>
              <Input type="number" min={20} max={31} value={settings.daysPerMonth} onChange={(e) => setSettings({ ...settings, daysPerMonth: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label>{t("payroll:rules.hoursPerDay")}</Label>
              <Input type="number" min={1} max={12} value={settings.hoursPerDay} onChange={(e) => setSettings({ ...settings, hoursPerDay: Number(e.target.value) })} />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("payroll:rules.periodExample", { start: settings.cutoffDay + 1, end: settings.cutoffDay })}
          </p>
          <div className="space-y-1 md:max-w-xl">
            <Label>{t("payroll:rules.defaultScheduleMode")}</Label>
            <Select value={settings.defaultScheduleMode} onValueChange={(v) => setSettings({ ...settings, defaultScheduleMode: v as "fixed" | "rotating" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">{t("payroll:rules.modeFixed")}</SelectItem>
                <SelectItem value="rotating">{t("payroll:rules.modeRotating")}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t("payroll:rules.scheduleModeHint")}</p>
          </div>
          <Button disabled={busy} onClick={() => run(() => payrollApi.saveSettings(settings), t("common:common.saveFailed"))}>{t("common:actions.save")}</Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("payroll:rules.overtimeTitle")}</CardTitle>
            <CardDescription>{t("payroll:rules.overtimeHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {rules.length === 0 ? (
              <div className="space-y-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                <p>{t("payroll:rules.noOvertimeRules")}</p>
                <Button variant="outline" disabled={busy} onClick={() => run(() => payrollApi.loadOvertimeTemplate(), t("payroll:rules.loadFailed"))}>
                  <Wand2 className="mr-2 h-4 w-4" /> {t("payroll:rules.loadTemplate")}
                </Button>
                <p className="text-xs">{t("payroll:rules.templateWarning")}</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("payroll:rules.dayType")}</TableHead>
                      <TableHead>{t("payroll:rules.hoursRange")}</TableHead>
                      <TableHead className="text-right">{t("payroll:rules.multiplier")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell>{t(`payroll:dayTypes.${r.dayType}`)}</TableCell>
                        <TableCell>{rangeLabel(r)}</TableCell>
                        <TableCell className="text-right font-medium">{r.multiplier}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <Textarea rows={5} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={"dayType,fromHours,toHours,multiplier\nweekday,0,2,1.34"} />
            <div className="flex gap-2">
              <Button disabled={busy || !csv.trim()} onClick={() => run(() => payrollApi.importOvertimeRules(csv), t("payroll:rates.importFailed"), () => setCsv(""))}>
                <Upload className="mr-2 h-4 w-4" /> {t("payroll:rules.importReplace")}
              </Button>
              <Button variant="outline" onClick={downloadTemplate}><Download className="mr-2 h-4 w-4" /> {t("payroll:rates.template")}</Button>
            </div>
            <p className="text-xs text-muted-foreground">{t("payroll:rules.csvHint")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("payroll:rules.leaveTitle")}</CardTitle>
            <CardDescription>{t("payroll:rules.leaveHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("payroll:rules.leaveType")}</TableHead>
                    <TableHead>{t("payroll:rules.paidFlag")}</TableHead>
                    <TableHead className="w-36">{t("payroll:rules.deductRatio")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deductions.map((d) => (
                    <TableRow key={d.leaveTypeId}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{d.isPaid ? t("common:common.yes") : t("common:common.no")}</TableCell>
                      <TableCell>
                        <Input
                          type="number" min={0} max={1} step={0.25} className="h-8"
                          placeholder={t("payroll:rules.unset")}
                          value={ratioInputs[d.leaveTypeId] ?? ""}
                          onChange={(e) => setRatioInputs({ ...ratioInputs, [d.leaveTypeId]: e.target.value })}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {unsetCount > 0 && <p className="text-xs text-amber-700">{t("payroll:rules.unsetWarning", { count: unsetCount })}</p>}
            <div className="flex gap-2">
              <Button disabled={busy} onClick={saveDeductions}>{t("common:actions.save")}</Button>
              <Button variant="outline" disabled={busy || unsetCount === 0} onClick={() => run(() => payrollApi.prefillLeaveDeductions(), t("common:common.operationFailed"))}>
                <Wand2 className="mr-2 h-4 w-4" /> {t("payroll:rules.prefill")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>{t("payroll:rules.allowanceTitle")}</CardTitle>
            <CardDescription>{t("payroll:rules.allowanceHint")}</CardDescription>
          </div>
          <Button onClick={() => openAllowance(null)} className="bg-hrms-accent">{t("payroll:rules.addAllowance")}</Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("payroll:rules.allowanceName")}</TableHead>
                  <TableHead>{t("payroll:rules.allowanceDays")}</TableHead>
                  <TableHead>{t("payroll:rules.amountPerDay")}</TableHead>
                  <TableHead>{t("payroll:rules.requireAttendance")}</TableHead>
                  <TableHead>{t("payroll:rules.active")}</TableHead>
                  <TableHead className="text-right">{t("common:table.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allowances.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="py-6 text-center text-muted-foreground">{t("payroll:rules.noAllowance")}</TableCell></TableRow>
                ) : allowances.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>{weekdayLabel(r)}</TableCell>
                    <TableCell>{r.amount.toLocaleString()}</TableCell>
                    <TableCell>{r.requireAttendance ? t("common:common.yes") : t("common:common.no")}</TableCell>
                    <TableCell>{r.active ? t("common:common.yes") : t("common:common.no")}</TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button size="sm" variant="outline" onClick={() => openAllowance(r)}>{t("common:actions.edit")}</Button>
                      <Button size="sm" variant="outline" onClick={() => setDeletingAllowance(r)}>{t("common:actions.delete")}</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={allowanceOpen} onOpenChange={setAllowanceOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingAllowance ? t("payroll:rules.editAllowance") : t("payroll:rules.addAllowance")}</DialogTitle></DialogHeader>
          <form onSubmit={saveAllowance} className="space-y-4">
            <div className="space-y-1">
              <Label>{t("payroll:rules.allowanceName")}</Label>
              <Input required value={allowanceForm.name} onChange={(e) => setAllowanceForm({ ...allowanceForm, name: e.target.value })} placeholder={t("payroll:rules.allowanceNamePlaceholder")} />
            </div>
            <div className="space-y-2">
              <Label>{t("payroll:rules.allowanceDays")}</Label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((d) => (
                  <Button key={d} type="button" size="sm" variant={allowanceForm.weekdays.includes(d) ? "default" : "outline"} onClick={() => toggleWeekday(d)}>
                    {t(`payroll:weekdays.${d}`)}
                  </Button>
                ))}
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <Label>{t("payroll:rules.includeHolidays")}</Label>
                <Switch checked={allowanceForm.includeNationalHolidays} onCheckedChange={(v) => setAllowanceForm({ ...allowanceForm, includeNationalHolidays: v })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>{t("payroll:rules.amountPerDay")}</Label>
              <Input type="number" min={1} step={1} required value={allowanceForm.amount} onChange={(e) => setAllowanceForm({ ...allowanceForm, amount: e.target.value })} />
            </div>
            <div className="space-y-3 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label>{t("payroll:rules.requireAttendance")}</Label>
                  <p className="text-xs text-muted-foreground">{t("payroll:rules.requireAttendanceHint")}</p>
                </div>
                <Switch checked={allowanceForm.requireAttendance} onCheckedChange={(v) => setAllowanceForm({ ...allowanceForm, requireAttendance: v })} />
              </div>
              <div className="flex items-center justify-between">
                <Label>{t("payroll:rules.active")}</Label>
                <Switch checked={allowanceForm.active} onCheckedChange={(v) => setAllowanceForm({ ...allowanceForm, active: v })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAllowanceOpen(false)}>{t("common:actions.cancel")}</Button>
              <Button type="submit" disabled={busy}>{t("common:actions.save")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingAllowance} onOpenChange={(open) => !open && setDeletingAllowance(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common:common.confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("payroll:rules.deleteAllowanceHint", { name: deletingAllowance?.name })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common:actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingAllowance && run(() => payrollApi.deleteAllowanceRule(deletingAllowance.id), t("common:common.deleteFailed"), () => setDeletingAllowance(null))}>
              {t("common:actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PayrollRulesPanel;
