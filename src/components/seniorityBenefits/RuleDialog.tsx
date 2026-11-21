import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SeniorityBenefitRule, SeniorityBenefitRuleFormData, SeniorityBenefitType } from "@/types/seniorityBenefit";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: SeniorityBenefitRule | null;
  onSubmit: (data: SeniorityBenefitRuleFormData) => Promise<void>;
}

const emptyForm = {
  name: "",
  type: "retention_bonus" as SeniorityBenefitType,
  startYears: "3",
  repeatEveryYears: "",
  amount: "",
  remindDaysBefore: "30",
  notifyHr: true,
  active: true,
  notes: "",
};

const RuleDialog = ({ open, onOpenChange, rule, onSubmit }: Props) => {
  const { t } = useTranslation(["seniorityBenefits", "common"]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      rule
        ? {
            name: rule.name,
            type: rule.type,
            startYears: String(rule.startYears),
            repeatEveryYears: rule.repeatEveryYears === null ? "" : String(rule.repeatEveryYears),
            amount: rule.amount === null ? "" : String(rule.amount),
            remindDaysBefore: String(rule.remindDaysBefore),
            notifyHr: rule.notifyHr,
            active: rule.active,
            notes: rule.notes ?? "",
          }
        : emptyForm
    );
  }, [open, rule]);

  const set = <K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        name: form.name.trim(),
        type: form.type,
        startYears: Number(form.startYears),
        repeatEveryYears: form.repeatEveryYears === "" ? null : Number(form.repeatEveryYears),
        amount: form.amount === "" ? null : Number(form.amount),
        remindDaysBefore: Number(form.remindDaysBefore),
        notifyHr: form.notifyHr,
        active: form.active,
        notes: form.notes.trim() || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{rule ? t("seniorityBenefits:rules.editTitle") : t("seniorityBenefits:rules.addTitle")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t("seniorityBenefits:rules.name")}</Label>
            <Input required value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("seniorityBenefits:rules.type")}</Label>
              <Select value={form.type} onValueChange={(v) => set("type", v as SeniorityBenefitType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="travel_subsidy">{t("seniorityBenefits:types.travel_subsidy")}</SelectItem>
                  <SelectItem value="retention_bonus">{t("seniorityBenefits:types.retention_bonus")}</SelectItem>
                  <SelectItem value="other">{t("seniorityBenefits:types.other")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("seniorityBenefits:rules.amount")}</Label>
              <Input type="number" min={0} value={form.amount} onChange={(e) => set("amount", e.target.value)}
                placeholder={t("common:common.optional")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("seniorityBenefits:rules.startYears")}</Label>
              <Input type="number" min={0} step={1} required value={form.startYears}
                onChange={(e) => set("startYears", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("seniorityBenefits:rules.repeatEveryYears")}</Label>
              <Input type="number" min={1} step={1} value={form.repeatEveryYears}
                onChange={(e) => set("repeatEveryYears", e.target.value)}
                placeholder={t("seniorityBenefits:rules.repeatPlaceholder")} />
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">{t("seniorityBenefits:rules.scheduleHint")}</p>
          <div className="space-y-2">
            <Label>{t("seniorityBenefits:rules.remindDaysBefore")}</Label>
            <Input type="number" min={0} max={365} step={1} required value={form.remindDaysBefore}
              onChange={(e) => set("remindDaysBefore", e.target.value)} />
          </div>
          <div className="space-y-3 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <Label>{t("seniorityBenefits:rules.notifyHr")}</Label>
              <Switch checked={form.notifyHr} onCheckedChange={(v) => set("notifyHr", v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label>{t("seniorityBenefits:rules.active")}</Label>
              <Switch checked={form.active} onCheckedChange={(v) => set("active", v)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("common:table.note")}</Label>
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common:actions.cancel")}</Button>
            <Button type="submit" disabled={saving}>{t("common:actions.save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RuleDialog;
