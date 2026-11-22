import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { todayStr } from "@/lib/taipeiDate";
import { holidayBenefitApi } from "@/services/holidayBenefitApi";
import {
  HolidayBenefitRecord, HolidayBenefitRecordUpdate, HolidayBenefitRule,
  HolidayBenefitRuleFormData, HolidayDateSource,
} from "@/types/holidayBenefit";

const errorDescription = (error: unknown) => (error instanceof Error ? error.message : undefined);
const money = (value: number | null) => (value === null ? "—" : `NT$ ${value.toLocaleString()}`);

const emptyRule = { name: "", dateSource: "holiday_name" as HolidayDateSource, holidayKeyword: "", amount: "", remindDaysBefore: "14", active: true, notes: "" };

const HolidayBenefitsPanel = () => {
  const { t } = useTranslation(["seniorityBenefits", "common"]);
  const [rules, setRules] = useState<HolidayBenefitRule[]>([]);
  const [records, setRecords] = useState<HolidayBenefitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  // 規則對話框
  const [ruleOpen, setRuleOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<HolidayBenefitRule | null>(null);
  const [ruleForm, setRuleForm] = useState(emptyRule);
  const [deletingRule, setDeletingRule] = useState<HolidayBenefitRule | null>(null);

  // 年度紀錄對話框：新增（ruleId + 日期）、改日期、標記核發
  const [dateDialog, setDateDialog] = useState<{ record: HolidayBenefitRecord | null } | null>(null);
  const [dateRuleId, setDateRuleId] = useState("");
  const [dateValue, setDateValue] = useState("");
  const [payingRecord, setPayingRecord] = useState<HolidayBenefitRecord | null>(null);
  const [paidAt, setPaidAt] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [deletingRecord, setDeletingRecord] = useState<HolidayBenefitRecord | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [ruleData, recordData] = await Promise.all([holidayBenefitApi.getRules(), holidayBenefitApi.getRecords()]);
      setRules(ruleData);
      setRecords(recordData);
    } catch (error) {
      toast.error(t("common:common.loadFailed"), { description: errorDescription(error) });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const run = async (action: () => Promise<unknown>, failTitle: string, after?: () => void) => {
    try {
      await action();
      toast.success(t("common:common.saveSuccess"));
      after?.();
      await load();
    } catch (error) {
      toast.error(failTitle, { description: errorDescription(error) });
    }
  };

  const openRule = (rule: HolidayBenefitRule | null) => {
    setEditingRule(rule);
    setRuleForm(rule ? {
      name: rule.name, dateSource: rule.dateSource, holidayKeyword: rule.holidayKeyword ?? "",
      amount: rule.amount === null ? "" : String(rule.amount), remindDaysBefore: String(rule.remindDaysBefore),
      active: rule.active, notes: rule.notes ?? "",
    } : emptyRule);
    setRuleOpen(true);
  };

  const toRuleData = (f: typeof emptyRule): HolidayBenefitRuleFormData => ({
    name: f.name.trim(), dateSource: f.dateSource,
    holidayKeyword: f.dateSource === "holiday_name" ? f.holidayKeyword.trim() : null,
    amount: f.amount === "" ? null : Number(f.amount), remindDaysBefore: Number(f.remindDaysBefore),
    active: f.active, notes: f.notes.trim() || null,
  });

  const saveRule = (e: React.FormEvent) => {
    e.preventDefault();
    const data = toRuleData(ruleForm);
    run(() => (editingRule ? holidayBenefitApi.updateRule(editingRule.id, data) : holidayBenefitApi.createRule(data)),
      t("common:common.saveFailed"), () => setRuleOpen(false));
  };

  const toggleRule = (rule: HolidayBenefitRule, active: boolean) => {
    const { id: _id, ...rest } = rule;
    run(() => holidayBenefitApi.updateRule(rule.id, { ...rest, active }), t("common:common.saveFailed"));
  };

  const openDateDialog = (record: HolidayBenefitRecord | null) => {
    setDateDialog({ record });
    setDateRuleId(record ? String(record.ruleId) : "");
    setDateValue(record?.eventDate ?? "");
  };

  const saveDate = (e: React.FormEvent) => {
    e.preventDefault();
    const record = dateDialog?.record;
    run(() => (record
      ? holidayBenefitApi.updateRecord(record.id, { status: record.status, eventDate: dateValue, paidAt: record.paidAt, paidAmount: record.paidAmount, notes: record.notes })
      : holidayBenefitApi.createRecord(Number(dateRuleId), dateValue)),
      t("common:common.saveFailed"), () => setDateDialog(null));
  };

  const openPay = (record: HolidayBenefitRecord) => {
    setPayingRecord(record);
    setPaidAt(todayStr());
    setPaidAmount(String(record.estimatedTotal ?? ""));
  };

  const setStatus = (r: HolidayBenefitRecord, status: HolidayBenefitRecordUpdate["status"], extra: Partial<HolidayBenefitRecordUpdate> = {}) =>
    run(() => holidayBenefitApi.updateRecord(r.id, { status, notes: r.notes, ...extra }), t("common:common.saveFailed"), () => setPayingRecord(null));

  const handleCheck = async () => {
    try {
      setChecking(true);
      const result = await holidayBenefitApi.runCheck();
      toast.success(t("seniorityBenefits:holiday.checkDone", { ...result }));
      await load();
    } catch (error) {
      toast.error(t("common:common.operationFailed"), { description: errorDescription(error) });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{t("seniorityBenefits:holiday.recordsTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("seniorityBenefits:holiday.recordsHint")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCheck} disabled={checking}>
              <RefreshCw className={`mr-2 h-4 w-4 ${checking ? "animate-spin" : ""}`} /> {t("seniorityBenefits:records.runCheck")}
            </Button>
            <Button onClick={() => openDateDialog(null)} disabled={rules.length === 0} className="bg-hrms-accent">
              <Plus className="mr-2 h-4 w-4" /> {t("seniorityBenefits:holiday.addRecord")}
            </Button>
          </div>
        </div>
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("seniorityBenefits:records.benefit")}</TableHead>
                <TableHead>{t("seniorityBenefits:holiday.year")}</TableHead>
                <TableHead>{t("seniorityBenefits:holiday.eventDate")}</TableHead>
                <TableHead>{t("common:table.status")}</TableHead>
                <TableHead>{t("seniorityBenefits:holiday.headcount")}</TableHead>
                <TableHead>{t("seniorityBenefits:holiday.total")}</TableHead>
                <TableHead className="text-right">{t("common:table.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="py-8 text-center">{t("common:common.loading")}</TableCell></TableRow>
              ) : records.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">{t("seniorityBenefits:holiday.noRecords")}</TableCell></TableRow>
              ) : records.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.ruleName}</TableCell>
                  <TableCell>{r.year}</TableCell>
                  <TableCell>{r.eventDate}</TableCell>
                  <TableCell><Badge variant={r.status === "notified" ? "default" : r.status === "paid" ? "secondary" : "outline"}>{t(`seniorityBenefits:status.${r.status}`)}</Badge></TableCell>
                  <TableCell>{r.headcount ?? "—"}</TableCell>
                  <TableCell>{r.status === "paid" ? `${money(r.paidAmount)}（${r.paidAt ?? ""}）` : money(r.estimatedTotal ?? null)}</TableCell>
                  <TableCell className="space-x-2 text-right">
                    {(r.status === "pending" || r.status === "notified") && (
                      <>
                        <Button size="sm" onClick={() => openPay(r)}>{t("seniorityBenefits:records.markPaid")}</Button>
                        <Button size="sm" variant="outline" onClick={() => openDateDialog(r)}>{t("seniorityBenefits:holiday.changeDate")}</Button>
                        <Button size="sm" variant="outline" onClick={() => setStatus(r, "skipped")}>{t("seniorityBenefits:records.skip")}</Button>
                        <Button size="sm" variant="outline" onClick={() => setDeletingRecord(r)}>{t("common:actions.delete")}</Button>
                      </>
                    )}
                    {(r.status === "paid" || r.status === "skipped") && (
                      <Button size="sm" variant="outline" onClick={() => setStatus(r, "notified")}>{t("seniorityBenefits:records.revert")}</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{t("seniorityBenefits:holiday.rulesTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("seniorityBenefits:holiday.rulesHint")}</p>
          </div>
          <Button onClick={() => openRule(null)} className="bg-hrms-accent">
            <Plus className="mr-2 h-4 w-4" /> {t("seniorityBenefits:rules.add")}
          </Button>
        </div>
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("seniorityBenefits:rules.name")}</TableHead>
                <TableHead>{t("seniorityBenefits:holiday.dateSource")}</TableHead>
                <TableHead>{t("seniorityBenefits:holiday.amountPerPerson")}</TableHead>
                <TableHead>{t("seniorityBenefits:rules.remindDaysBefore")}</TableHead>
                <TableHead>{t("seniorityBenefits:rules.active")}</TableHead>
                <TableHead className="text-right">{t("common:table.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">{t("seniorityBenefits:rules.empty")}</TableCell></TableRow>
              ) : rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.name}</TableCell>
                  <TableCell>
                    {rule.dateSource === "manual"
                      ? t("seniorityBenefits:holiday.sourceManual")
                      : t("seniorityBenefits:holiday.sourceKeyword", { keyword: rule.holidayKeyword })}
                  </TableCell>
                  <TableCell>{money(rule.amount)}</TableCell>
                  <TableCell>{t("seniorityBenefits:rules.daysValue", { count: rule.remindDaysBefore })}</TableCell>
                  <TableCell><Switch checked={rule.active} onCheckedChange={(v) => toggleRule(rule, v)} /></TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => openRule(rule)}>{t("common:actions.edit")}</Button>
                    <Button size="sm" variant="outline" onClick={() => setDeletingRule(rule)}>{t("common:actions.delete")}</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* 規則 */}
      <Dialog open={ruleOpen} onOpenChange={setRuleOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingRule ? t("seniorityBenefits:holiday.editRuleTitle") : t("seniorityBenefits:holiday.addRuleTitle")}</DialogTitle></DialogHeader>
          <form onSubmit={saveRule} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("seniorityBenefits:rules.name")}</Label>
              <Input required value={ruleForm.name} onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })} placeholder={t("seniorityBenefits:holiday.namePlaceholder")} />
            </div>
            <div className="space-y-2">
              <Label>{t("seniorityBenefits:holiday.dateSource")}</Label>
              <Select value={ruleForm.dateSource} onValueChange={(v) => setRuleForm({ ...ruleForm, dateSource: v as HolidayDateSource })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="holiday_name">{t("seniorityBenefits:holiday.optKeyword")}</SelectItem>
                  <SelectItem value="manual">{t("seniorityBenefits:holiday.optManual")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {ruleForm.dateSource === "holiday_name" ? (
              <div className="space-y-2">
                <Label>{t("seniorityBenefits:holiday.keyword")}</Label>
                <Input required value={ruleForm.holidayKeyword} onChange={(e) => setRuleForm({ ...ruleForm, holidayKeyword: e.target.value })} placeholder={t("seniorityBenefits:holiday.keywordPlaceholder")} />
                <p className="text-xs text-muted-foreground">{t("seniorityBenefits:holiday.keywordHint")}</p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t("seniorityBenefits:holiday.manualHint")}</p>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("seniorityBenefits:holiday.amountPerPerson")}</Label>
                <Input type="number" min={0} value={ruleForm.amount} onChange={(e) => setRuleForm({ ...ruleForm, amount: e.target.value })} placeholder={t("common:common.optional")} />
              </div>
              <div className="space-y-2">
                <Label>{t("seniorityBenefits:rules.remindDaysBefore")}</Label>
                <Input type="number" min={0} max={365} step={1} required value={ruleForm.remindDaysBefore} onChange={(e) => setRuleForm({ ...ruleForm, remindDaysBefore: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label>{t("seniorityBenefits:rules.active")}</Label>
              <Switch checked={ruleForm.active} onCheckedChange={(v) => setRuleForm({ ...ruleForm, active: v })} />
            </div>
            <div className="space-y-2">
              <Label>{t("common:table.note")}</Label>
              <Textarea value={ruleForm.notes} onChange={(e) => setRuleForm({ ...ruleForm, notes: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRuleOpen(false)}>{t("common:actions.cancel")}</Button>
              <Button type="submit">{t("common:actions.save")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 新增年度日期／改日期 */}
      <Dialog open={!!dateDialog} onOpenChange={(open) => !open && setDateDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{dateDialog?.record ? t("seniorityBenefits:holiday.changeDate") : t("seniorityBenefits:holiday.addRecord")}</DialogTitle></DialogHeader>
          <form onSubmit={saveDate} className="space-y-4">
            {!dateDialog?.record && (
              <div className="space-y-2">
                <Label>{t("seniorityBenefits:records.benefit")}</Label>
                <Select value={dateRuleId} onValueChange={setDateRuleId}>
                  <SelectTrigger><SelectValue placeholder={t("seniorityBenefits:holiday.selectRule")} /></SelectTrigger>
                  <SelectContent>{rules.map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>{t("seniorityBenefits:holiday.eventDate")}</Label>
              <Input type="date" required value={dateValue} onChange={(e) => setDateValue(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDateDialog(null)}>{t("common:actions.cancel")}</Button>
              <Button type="submit" disabled={!dateDialog?.record && !dateRuleId}>{t("common:actions.save")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 標記已核發 */}
      <Dialog open={!!payingRecord} onOpenChange={(open) => !open && setPayingRecord(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("seniorityBenefits:records.markPaidTitle")}</DialogTitle></DialogHeader>
          {payingRecord && (
            <form onSubmit={(e) => { e.preventDefault(); setStatus(payingRecord, "paid", { paidAt: paidAt || null, paidAmount: paidAmount === "" ? null : Number(paidAmount) }); }} className="space-y-4">
              <p className="text-sm text-muted-foreground">{payingRecord.year} · {payingRecord.ruleName}</p>
              <div className="space-y-2">
                <Label>{t("seniorityBenefits:records.paidAt")}</Label>
                <Input type="date" required value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("seniorityBenefits:holiday.paidTotal")}</Label>
                <Input type="number" min={0} value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setPayingRecord(null)}>{t("common:actions.cancel")}</Button>
                <Button type="submit">{t("common:actions.confirm")}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingRule} onOpenChange={(open) => !open && setDeletingRule(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common:common.confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("seniorityBenefits:rules.deleteHint", { name: deletingRule?.name })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common:actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingRule && run(() => holidayBenefitApi.deleteRule(deletingRule.id), t("common:common.deleteFailed"), () => setDeletingRule(null))}>
              {t("common:actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingRecord} onOpenChange={(open) => !open && setDeletingRecord(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common:common.confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("seniorityBenefits:holiday.deleteRecordHint", { name: deletingRecord?.ruleName, year: deletingRecord?.year })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common:actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingRecord && run(() => holidayBenefitApi.deleteRecord(deletingRecord.id), t("common:common.deleteFailed"), () => setDeletingRecord(null))}>
              {t("common:actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default HolidayBenefitsPanel;
