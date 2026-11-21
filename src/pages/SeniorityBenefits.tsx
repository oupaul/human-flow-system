import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import RuleDialog from "@/components/seniorityBenefits/RuleDialog";
import RecordDialog from "@/components/seniorityBenefits/RecordDialog";
import { seniorityBenefitApi } from "@/services/seniorityBenefitApi";
import {
  SeniorityBenefitRecord, SeniorityBenefitRecordStatus, SeniorityBenefitRecordUpdate,
  SeniorityBenefitRule, SeniorityBenefitRuleFormData,
} from "@/types/seniorityBenefit";

type RecordFilter = "open" | SeniorityBenefitRecordStatus | "all";

const STATUS_VARIANT: Record<SeniorityBenefitRecordStatus, "default" | "secondary" | "outline"> = {
  pending: "outline",
  notified: "default",
  paid: "secondary",
  skipped: "outline",
};

const errorDescription = (error: unknown) => (error instanceof Error ? error.message : undefined);

const SeniorityBenefits = () => {
  const { t } = useTranslation(["seniorityBenefits", "common"]);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "rules" ? "rules" : "records";

  const [rules, setRules] = useState<SeniorityBenefitRule[]>([]);
  const [records, setRecords] = useState<SeniorityBenefitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<RecordFilter>("open");
  const [checking, setChecking] = useState(false);

  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<SeniorityBenefitRule | null>(null);
  const [deletingRule, setDeletingRule] = useState<SeniorityBenefitRule | null>(null);
  const [payingRecord, setPayingRecord] = useState<SeniorityBenefitRecord | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [ruleData, recordData] = await Promise.all([seniorityBenefitApi.getRules(), seniorityBenefitApi.getRecords()]);
      setRules(ruleData);
      setRecords(recordData);
    } catch (error) {
      console.error("Failed to load seniority benefits:", error);
      toast.error(t("common:common.loadFailed"), { description: errorDescription(error) });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const handleSaveRule = async (data: SeniorityBenefitRuleFormData) => {
    try {
      if (editingRule) await seniorityBenefitApi.updateRule(editingRule.id, data);
      else await seniorityBenefitApi.createRule(data);
      toast.success(t("common:common.saveSuccess"));
      setRuleDialogOpen(false);
      await load();
    } catch (error) {
      toast.error(t("common:common.saveFailed"), { description: errorDescription(error) });
    }
  };

  const handleToggleRule = async (rule: SeniorityBenefitRule, active: boolean) => {
    try {
      const { id: _id, ...rest } = rule;
      await seniorityBenefitApi.updateRule(rule.id, { ...rest, active });
      await load();
    } catch (error) {
      toast.error(t("common:common.saveFailed"), { description: errorDescription(error) });
    }
  };

  const handleDeleteRule = async () => {
    if (!deletingRule) return;
    try {
      await seniorityBenefitApi.deleteRule(deletingRule.id);
      toast.success(t("common:common.deleteSuccess"));
      await load();
    } catch (error) {
      toast.error(t("common:common.deleteFailed"), { description: errorDescription(error) });
    } finally {
      setDeletingRule(null);
    }
  };

  const handleUpdateRecord = async (id: number, data: SeniorityBenefitRecordUpdate) => {
    try {
      await seniorityBenefitApi.updateRecord(id, data);
      toast.success(t("common:common.saveSuccess"));
      setPayingRecord(null);
      await load();
    } catch (error) {
      toast.error(t("common:common.saveFailed"), { description: errorDescription(error) });
    }
  };

  const handleRunCheck = async () => {
    try {
      setChecking(true);
      const result = await seniorityBenefitApi.runCheck();
      toast.success(t("seniorityBenefits:records.checkDone", { ...result }));
      await load();
    } catch (error) {
      toast.error(t("common:common.operationFailed"), { description: errorDescription(error) });
    } finally {
      setChecking(false);
    }
  };

  const openRuleDialog = (rule: SeniorityBenefitRule | null) => {
    setEditingRule(rule);
    setRuleDialogOpen(true);
  };

  const visibleRecords = records.filter((r) =>
    filter === "all" ? true : filter === "open" ? r.status === "pending" || r.status === "notified" : r.status === filter
  );

  const money = (value: number | null) => (value === null ? "—" : `NT$ ${value.toLocaleString()}`);

  const schedule = (rule: SeniorityBenefitRule) =>
    rule.repeatEveryYears
      ? t("seniorityBenefits:rules.scheduleRepeat", { start: rule.startYears, every: rule.repeatEveryYears })
      : t("seniorityBenefits:rules.scheduleOnce", { start: rule.startYears });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("common:nav.seniorityBenefits")}</h1>
        {activeTab === "rules" ? (
          <Button onClick={() => openRuleDialog(null)} className="bg-hrms-accent">
            <Plus className="mr-2 h-4 w-4" /> {t("seniorityBenefits:rules.add")}
          </Button>
        ) : (
          <Button variant="outline" onClick={handleRunCheck} disabled={checking}>
            <RefreshCw className={`mr-2 h-4 w-4 ${checking ? "animate-spin" : ""}`} /> {t("seniorityBenefits:records.runCheck")}
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setSearchParams(v === "rules" ? { tab: "rules" } : {})}>
        <TabsList>
          <TabsTrigger value="records">{t("seniorityBenefits:tabs.records")}</TabsTrigger>
          <TabsTrigger value="rules">{t("seniorityBenefits:tabs.rules")}</TabsTrigger>
        </TabsList>

        <TabsContent value="records" className="space-y-4">
          <div className="flex items-center gap-3">
            <Select value={filter} onValueChange={(v) => setFilter(v as RecordFilter)}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">{t("seniorityBenefits:records.filterOpen")}</SelectItem>
                <SelectItem value="paid">{t("seniorityBenefits:status.paid")}</SelectItem>
                <SelectItem value="skipped">{t("seniorityBenefits:status.skipped")}</SelectItem>
                <SelectItem value="all">{t("seniorityBenefits:records.filterAll")}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">{t("seniorityBenefits:records.hint")}</p>
          </div>
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common:table.name")}</TableHead>
                  <TableHead>{t("common:table.department")}</TableHead>
                  <TableHead>{t("seniorityBenefits:records.benefit")}</TableHead>
                  <TableHead>{t("seniorityBenefits:records.eligibleDate")}</TableHead>
                  <TableHead>{t("common:table.status")}</TableHead>
                  <TableHead>{t("seniorityBenefits:records.paidAmount")}</TableHead>
                  <TableHead className="text-right">{t("common:table.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center">{t("common:common.loading")}</TableCell></TableRow>
                ) : visibleRecords.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">{t("common:common.noData")}</TableCell></TableRow>
                ) : (
                  visibleRecords.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.employeeName}（{r.employeeId}）</TableCell>
                      <TableCell>{r.department}</TableCell>
                      <TableCell>{r.ruleName}</TableCell>
                      <TableCell>{r.eligibleDate}</TableCell>
                      <TableCell><Badge variant={STATUS_VARIANT[r.status]}>{t(`seniorityBenefits:status.${r.status}`)}</Badge></TableCell>
                      <TableCell>{r.status === "paid" ? `${money(r.paidAmount)}（${r.paidAt ?? ""}）` : money(r.ruleAmount)}</TableCell>
                      <TableCell className="space-x-2 text-right">
                        {(r.status === "pending" || r.status === "notified") && (
                          <>
                            <Button size="sm" onClick={() => setPayingRecord(r)}>{t("seniorityBenefits:records.markPaid")}</Button>
                            <Button size="sm" variant="outline" onClick={() => handleUpdateRecord(r.id, { status: "skipped", notes: r.notes })}>
                              {t("seniorityBenefits:records.skip")}
                            </Button>
                          </>
                        )}
                        {(r.status === "paid" || r.status === "skipped") && (
                          <Button size="sm" variant="outline" onClick={() => handleUpdateRecord(r.id, { status: "notified", notes: r.notes })}>
                            {t("seniorityBenefits:records.revert")}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("seniorityBenefits:rules.hint")}</p>
          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("seniorityBenefits:rules.name")}</TableHead>
                  <TableHead>{t("seniorityBenefits:rules.type")}</TableHead>
                  <TableHead>{t("seniorityBenefits:rules.schedule")}</TableHead>
                  <TableHead>{t("seniorityBenefits:rules.amount")}</TableHead>
                  <TableHead>{t("seniorityBenefits:rules.remindDaysBefore")}</TableHead>
                  <TableHead>{t("seniorityBenefits:rules.notifyTo")}</TableHead>
                  <TableHead>{t("seniorityBenefits:rules.active")}</TableHead>
                  <TableHead className="text-right">{t("common:table.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">{t("seniorityBenefits:rules.empty")}</TableCell></TableRow>
                ) : (
                  rules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell className="font-medium">{rule.name}</TableCell>
                      <TableCell>{t(`seniorityBenefits:types.${rule.type}`)}</TableCell>
                      <TableCell>{schedule(rule)}</TableCell>
                      <TableCell>{money(rule.amount)}</TableCell>
                      <TableCell>{t("seniorityBenefits:rules.daysValue", { count: rule.remindDaysBefore })}</TableCell>
                      <TableCell>
                        {[rule.notifyHr && t("seniorityBenefits:rules.toHr"), rule.notifyEmployee && t("seniorityBenefits:rules.toEmployee")]
                          .filter(Boolean).join(" / ") || "—"}
                      </TableCell>
                      <TableCell><Switch checked={rule.active} onCheckedChange={(v) => handleToggleRule(rule, v)} /></TableCell>
                      <TableCell className="space-x-2 text-right">
                        <Button size="sm" variant="outline" onClick={() => openRuleDialog(rule)}>{t("common:actions.edit")}</Button>
                        <Button size="sm" variant="outline" onClick={() => setDeletingRule(rule)}>{t("common:actions.delete")}</Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <RuleDialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen} rule={editingRule} onSubmit={handleSaveRule} />
      <RecordDialog record={payingRecord} onClose={() => setPayingRecord(null)} onSubmit={handleUpdateRecord} />

      <AlertDialog open={!!deletingRule} onOpenChange={(open) => !open && setDeletingRule(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common:common.confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("seniorityBenefits:rules.deleteHint", { name: deletingRule?.name })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common:actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRule}>{t("common:actions.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SeniorityBenefits;
