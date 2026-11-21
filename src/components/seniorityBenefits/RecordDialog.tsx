import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SeniorityBenefitRecord, SeniorityBenefitRecordUpdate } from "@/types/seniorityBenefit";

interface Props {
  record: SeniorityBenefitRecord | null;
  onClose: () => void;
  onSubmit: (id: number, data: SeniorityBenefitRecordUpdate) => Promise<void>;
}

// 標記「已核發」：填實際核發日期與金額（金額預設帶入規則的參考金額）
const RecordDialog = ({ record, onClose, onSubmit }: Props) => {
  const { t } = useTranslation(["seniorityBenefits", "common"]);
  const [paidAt, setPaidAt] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!record) return;
    setPaidAt(record.paidAt ?? new Date().toISOString().slice(0, 10));
    setPaidAmount(String(record.paidAmount ?? record.ruleAmount ?? ""));
    setNotes(record.notes ?? "");
  }, [record]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!record) return;
    setSaving(true);
    try {
      await onSubmit(record.id, {
        status: "paid",
        paidAt: paidAt || null,
        paidAmount: paidAmount === "" ? null : Number(paidAmount),
        notes: notes.trim() || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!record} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("seniorityBenefits:records.markPaidTitle")}</DialogTitle>
        </DialogHeader>
        {record && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {record.employeeName}（{record.employeeId}）· {record.ruleName}
            </p>
            <div className="space-y-2">
              <Label>{t("seniorityBenefits:records.paidAt")}</Label>
              <Input type="date" required value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("seniorityBenefits:records.paidAmount")}</Label>
              <Input type="number" min={0} value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("common:table.note")}</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>{t("common:actions.cancel")}</Button>
              <Button type="submit" disabled={saving}>{t("common:actions.confirm")}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RecordDialog;
