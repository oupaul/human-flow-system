import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { scheduleApi } from "@/services/scheduleApi";
import { OffType, ScheduleEmployee, ShiftType } from "@/types/schedule";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  month: string;
  employees: ScheduleEmployee[];
  shiftTypes: ShiftType[];
  onDone: () => void;
}

const lastDay = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
};

// 快速填入：選員工、日期區間、星期，一次填同一個班別或排休類別（或清除）
const QuickFillDialog = ({ open, onOpenChange, month, employees, shiftTypes, onDone }: Props) => {
  const { t } = useTranslation(["schedule", "common"]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [from, setFrom] = useState(`${month}-01`);
  const [to, setTo] = useState(lastDay(month));
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setFrom(`${month}-01`); setTo(lastDay(month)); setSelected(new Set()); setChoice(""); }
  }, [open, month]);

  const toggleDay = (d: number) => setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d].sort()));
  const toggleEmp = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const submit = async () => {
    const base = { employeeIds: [...selected], from, to, weekdays };
    try {
      setBusy(true);
      let result;
      if (choice === "clear") result = await scheduleApi.fill({ ...base, clear: true });
      else if (choice.startsWith("shift:")) result = await scheduleApi.fill({ ...base, kind: "shift", shiftTypeId: Number(choice.slice(6)) });
      else result = await scheduleApi.fill({ ...base, kind: "off", offType: choice.slice(4) as OffType });
      toast.success(t("schedule:quickFill.done", { count: result.changed }));
      onOpenChange(false);
      onDone();
    } catch (error) {
      toast.error(t("common:common.saveFailed"), { description: error instanceof Error ? error.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("schedule:quickFill.title")}</DialogTitle>
          <DialogDescription>{t("schedule:quickFill.description")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <Label>{t("schedule:quickFill.employees")}（{selected.size}）</Label>
              <Button type="button" size="sm" variant="outline" onClick={() => setSelected(selected.size === employees.length ? new Set() : new Set(employees.map((e) => e.employeeId)))}>
                {selected.size === employees.length ? t("schedule:quickFill.clearAll") : t("schedule:quickFill.selectAll")}
              </Button>
            </div>
            <div className="max-h-40 overflow-y-auto rounded-md border p-2">
              {employees.map((e) => (
                <label key={e.employeeId} className="flex cursor-pointer items-center gap-2 py-0.5 text-sm">
                  <Checkbox checked={selected.has(e.employeeId)} onCheckedChange={() => toggleEmp(e.employeeId)} />
                  {e.name}（{e.employeeId}）<span className="text-xs text-muted-foreground">{e.department}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>{t("schedule:quickFill.from")}</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div className="space-y-1"><Label>{t("schedule:quickFill.to")}</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          </div>
          <div className="space-y-1">
            <Label>{t("schedule:quickFill.weekdays")}</Label>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <Button key={d} type="button" size="sm" variant={weekdays.includes(d) ? "default" : "outline"} onClick={() => toggleDay(d)}>{t(`schedule:weekdays.${d}`)}</Button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label>{t("schedule:quickFill.fillWith")}</Label>
            <Select value={choice} onValueChange={setChoice}>
              <SelectTrigger><SelectValue placeholder={t("schedule:quickFill.choose")} /></SelectTrigger>
              <SelectContent>
                {shiftTypes.filter((s) => s.active).map((s) => <SelectItem key={s.id} value={`shift:${s.id}`}>{s.name}（{s.startTime}~{s.endTime}）</SelectItem>)}
                <SelectItem value="off:rest_day">{t("schedule:off.rest_day")}</SelectItem>
                <SelectItem value="off:regular_off">{t("schedule:off.regular_off")}</SelectItem>
                <SelectItem value="off:national_holiday">{t("schedule:off.national_holiday")}</SelectItem>
                <SelectItem value="clear">{t("schedule:quickFill.clear")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common:actions.cancel")}</Button>
          <Button disabled={busy || selected.size === 0 || !choice || weekdays.length === 0} onClick={submit}>{t("common:actions.confirm")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QuickFillDialog;
