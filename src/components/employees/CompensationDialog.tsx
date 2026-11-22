import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { compensationApi } from "@/services/compensationApi";
import { Compensation } from "@/types/compensation";

interface Props {
  employeeId: string | null;
  employeeName?: string;
  onClose: () => void;
  onChanged?: () => void;
}

const emptyForm = {
  effectiveDate: "", monthlySalary: "", laborInsuredSalary: "", healthInsuredSalary: "",
  pensionWage: "", voluntaryPensionRate: "", healthDependents: "", notes: "",
};

const num = (v: string) => (v === "" ? null : Number(v));
const money = (v: number | null) => (v === null ? "—" : v.toLocaleString());
const errorDescription = (error: unknown) => (error instanceof Error ? error.message : undefined);

const CompensationDialog = ({ employeeId, employeeName, onClose, onChanged }: Props) => {
  const { t } = useTranslation(["employees", "common"]);
  const [records, setRecords] = useState<Compensation[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<typeof emptyForm | null>(null); // null = 不顯示表單
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<Compensation | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!employeeId) return;
    try {
      setLoading(true);
      setRecords(await compensationApi.list(employeeId));
    } catch (error) {
      toast.error(t("common:common.loadFailed"), { description: errorDescription(error) });
    } finally {
      setLoading(false);
    }
  }, [employeeId, t]);

  useEffect(() => {
    setForm(null);
    setEditingId(null);
    load();
  }, [load]);

  const today = new Date().toISOString().slice(0, 10);
  // 目前生效的是「生效日 <= 今天」中最新的一筆（列表已依生效日由新到舊排序）
  const currentId = records.find((r) => r.effectiveDate <= today)?.id;

  const openAdd = () => {
    const latest = records[0];
    // 預設帶入最新一筆的內容，只改有變動的欄位即可
    setForm(latest ? {
      effectiveDate: today, monthlySalary: String(latest.monthlySalary),
      laborInsuredSalary: latest.laborInsuredSalary === null ? "" : String(latest.laborInsuredSalary),
      healthInsuredSalary: latest.healthInsuredSalary === null ? "" : String(latest.healthInsuredSalary),
      pensionWage: latest.pensionWage === null ? "" : String(latest.pensionWage),
      voluntaryPensionRate: latest.voluntaryPensionRate === null ? "" : String(latest.voluntaryPensionRate),
      healthDependents: latest.healthDependents === null ? "" : String(latest.healthDependents), notes: "",
    } : { ...emptyForm, effectiveDate: today });
    setEditingId(null);
  };

  const openEdit = (r: Compensation) => {
    setForm({
      effectiveDate: r.effectiveDate, monthlySalary: String(r.monthlySalary),
      laborInsuredSalary: r.laborInsuredSalary === null ? "" : String(r.laborInsuredSalary),
      healthInsuredSalary: r.healthInsuredSalary === null ? "" : String(r.healthInsuredSalary),
      pensionWage: r.pensionWage === null ? "" : String(r.pensionWage),
      voluntaryPensionRate: r.voluntaryPensionRate === null ? "" : String(r.voluntaryPensionRate),
      healthDependents: r.healthDependents === null ? "" : String(r.healthDependents), notes: r.notes ?? "",
    });
    setEditingId(r.id);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !employeeId) return;
    const data = {
      effectiveDate: form.effectiveDate, monthlySalary: Number(form.monthlySalary),
      laborInsuredSalary: num(form.laborInsuredSalary), healthInsuredSalary: num(form.healthInsuredSalary),
      pensionWage: num(form.pensionWage), voluntaryPensionRate: num(form.voluntaryPensionRate),
      healthDependents: num(form.healthDependents), notes: form.notes.trim() || null,
    };
    try {
      setSaving(true);
      if (editingId) await compensationApi.update(editingId, data);
      else await compensationApi.create(employeeId, data);
      toast.success(t("common:common.saveSuccess"));
      setForm(null);
      setEditingId(null);
      await load();
      onChanged?.();
    } catch (error) {
      toast.error(t("common:common.saveFailed"), { description: errorDescription(error) });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await compensationApi.remove(deleting.id);
      toast.success(t("common:common.deleteSuccess"));
      await load();
      onChanged?.();
    } catch (error) {
      toast.error(t("common:common.deleteFailed"), { description: errorDescription(error) });
    } finally {
      setDeleting(null);
    }
  };

  const field = (key: keyof typeof emptyForm, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input value={form?.[key] ?? ""} onChange={(e) => setForm((f) => (f ? { ...f, [key]: e.target.value } : f))} {...props} />
    </div>
  );

  return (
    <Dialog open={!!employeeId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("employees:compensation.title")}{employeeName ? ` · ${employeeName}` : ""}</DialogTitle>
          <DialogDescription>{t("employees:compensation.description")}</DialogDescription>
        </DialogHeader>

        <div className="flex justify-end">
          <Button onClick={openAdd} disabled={!!form} className="bg-hrms-accent">
            <Plus className="mr-2 h-4 w-4" /> {t("employees:compensation.add")}
          </Button>
        </div>

        {form && (
          <form onSubmit={save} className="space-y-4 rounded-md border p-4">
            <h4 className="font-semibold">{editingId ? t("employees:compensation.editTitle") : t("employees:compensation.addTitle")}</h4>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {field("effectiveDate", t("employees:compensation.effectiveDate"), { type: "date", required: true })}
              {field("monthlySalary", t("employees:compensation.monthlySalary"), { type: "number", min: 1, step: 1, required: true })}
              {field("healthDependents", t("employees:compensation.healthDependents"), { type: "number", min: 0, step: 1 })}
              {field("laborInsuredSalary", t("employees:compensation.laborInsuredSalary"), { type: "number", min: 0, step: 1 })}
              {field("healthInsuredSalary", t("employees:compensation.healthInsuredSalary"), { type: "number", min: 0, step: 1 })}
              {field("pensionWage", t("employees:compensation.pensionWage"), { type: "number", min: 0, step: 1 })}
              {field("voluntaryPensionRate", t("employees:compensation.voluntaryPensionRate"), { type: "number", min: 0, max: 6, step: 0.5 })}
            </div>
            <p className="text-xs text-muted-foreground">{t("employees:compensation.formHint")}</p>
            <div className="space-y-1">
              <Label>{t("common:table.note")}</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => { setForm(null); setEditingId(null); }}>{t("common:actions.cancel")}</Button>
              <Button type="submit" disabled={saving}>{t("common:actions.save")}</Button>
            </div>
          </form>
        )}

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("employees:compensation.effectiveDate")}</TableHead>
                <TableHead>{t("employees:compensation.monthlySalary")}</TableHead>
                <TableHead>{t("employees:compensation.laborInsuredSalary")}</TableHead>
                <TableHead>{t("employees:compensation.healthInsuredSalary")}</TableHead>
                <TableHead>{t("employees:compensation.pensionWage")}</TableHead>
                <TableHead>{t("employees:compensation.voluntaryPensionRate")}</TableHead>
                <TableHead>{t("employees:compensation.healthDependents")}</TableHead>
                <TableHead>{t("employees:compensation.changedBy")}</TableHead>
                <TableHead className="text-right">{t("common:table.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="py-6 text-center">{t("common:common.loading")}</TableCell></TableRow>
              ) : records.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="py-6 text-center text-muted-foreground">{t("employees:compensation.empty")}</TableCell></TableRow>
              ) : records.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    {r.effectiveDate}
                    {r.id === currentId && <Badge className="ml-2">{t("employees:compensation.current")}</Badge>}
                    {r.effectiveDate > today && <Badge variant="outline" className="ml-2">{t("employees:compensation.scheduled")}</Badge>}
                  </TableCell>
                  <TableCell className="font-medium">{money(r.monthlySalary)}</TableCell>
                  <TableCell>{money(r.laborInsuredSalary)}</TableCell>
                  <TableCell>{money(r.healthInsuredSalary)}</TableCell>
                  <TableCell>{money(r.pensionWage)}</TableCell>
                  <TableCell>{r.voluntaryPensionRate === null ? "—" : `${r.voluntaryPensionRate}%`}</TableCell>
                  <TableCell>{r.healthDependents ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.changedBy ?? "—"}</TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => openEdit(r)}>{t("common:actions.edit")}</Button>
                    <Button size="sm" variant="outline" onClick={() => setDeleting(r)}>{t("common:actions.delete")}</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("common:common.confirmDelete")}</AlertDialogTitle>
              <AlertDialogDescription>{t("employees:compensation.deleteHint", { date: deleting?.effectiveDate })}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common:actions.cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={remove}>{t("common:actions.delete")}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
};

export default CompensationDialog;
