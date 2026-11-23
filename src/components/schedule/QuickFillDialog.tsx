import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FillPreviewBox from "@/components/schedule/FillPreviewBox";
import PatternBuilder from "@/components/schedule/PatternBuilder";
import { scheduleApi } from "@/services/scheduleApi";
import { OffType, PatternStep, PreviewResult, ScheduleEmployee, ShiftType } from "@/types/schedule";

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

// 該月 1 日當週（或之前）最近的週一：預設的「一週樣式」從週一開始，起點日預設對齊週一
const mondayOnOrBefore = (month: string) => {
  const d = new Date(`${month}-01T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};

type Mode = "single" | "pattern";

// 快速填入：選員工與日期區間後，可「單一填入」（同一個班別或排休）或「輪替預排」
// （依輪替樣式一次排好所有人，可分組錯開起點，之後再人工微調）。套用前都會先預覽。
const QuickFillDialog = ({ open, onOpenChange, month, employees, shiftTypes, onDone }: Props) => {
  const { t } = useTranslation(["schedule", "common"]);
  const [mode, setMode] = useState<Mode>("single");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [from, setFrom] = useState(`${month}-01`);
  const [to, setTo] = useState(lastDay(month));
  // 單一填入
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [choice, setChoice] = useState("");
  // 輪替預排
  const [pattern, setPattern] = useState<PatternStep[]>([]);
  const [anchor, setAnchor] = useState(mondayOnOrBefore(month));
  const [groupSize, setGroupSize] = useState("");
  const [offsetStep, setOffsetStep] = useState("0");
  const [skipExisting, setSkipExisting] = useState(true);

  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFrom(`${month}-01`); setTo(lastDay(month)); setAnchor(mondayOnOrBefore(month)); setSelected(new Set()); setChoice("");
    const first = shiftTypes.find((s) => s.active);
    setPattern(first
      ? [...Array.from({ length: 5 }, (): PatternStep => ({ kind: "shift", shiftTypeId: first.id })), { kind: "off", offType: "rest_day" }, { kind: "off", offType: "regular_off" }]
      : Array.from({ length: 7 }, (): PatternStep => ({ kind: "skip" })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, month]);

  // 依畫面上的順序排列，輪替分組才符合直覺
  const orderedIds = useMemo(() => employees.filter((e) => selected.has(e.employeeId)).map((e) => e.employeeId), [employees, selected]);
  const patternReady = pattern.some((p) => p.kind !== "skip");
  const ready = orderedIds.length > 0 && !!from && !!to && from <= to && (mode === "single" ? !!choice && weekdays.length > 0 : patternReady && !!anchor);

  const patternParams = useMemo(() => ({
    employeeIds: orderedIds, from, to, anchor, pattern,
    groupSize: Number(groupSize) > 0 ? Number(groupSize) : orderedIds.length,
    offsetStep: Math.max(0, Number(offsetStep) || 0),
    skipExisting,
  }), [orderedIds, from, to, anchor, pattern, groupSize, offsetStep, skipExisting]);

  const singleFill = () => {
    const base = { employeeIds: orderedIds, from, to, weekdays };
    return choice === "clear" ? { ...base, clear: true }
      : choice.startsWith("shift:") ? { ...base, kind: "shift" as const, shiftTypeId: Number(choice.slice(6)) }
      : { ...base, kind: "off" as const, offType: choice.slice(4) as OffType };
  };

  // 預覽套用後會新增／修改幾格、新增或解除哪些排班警示（不會寫入）
  useEffect(() => {
    setPreview(null);
    if (!open || !ready) { setPreviewing(false); return; }
    let cancelled = false;
    setPreviewing(true);
    const scenario = mode === "single" ? { key: "fill", fill: singleFill() } : { key: "fill", pattern: patternParams };
    const timer = window.setTimeout(() => {
      scheduleApi.preview([scenario])
        .then((r) => { if (!cancelled) setPreview(r.results.fill ?? null); })
        .catch((error) => { if (!cancelled) { setPreview(null); if (mode === "pattern") toast.error(error instanceof Error ? error.message : t("common:common.loadFailed")); } })
        .finally(() => { if (!cancelled) setPreviewing(false); });
    }, 400);
    return () => { cancelled = true; window.clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ready, mode, orderedIds, choice, weekdays, from, to, patternParams]);

  const names = new Map(employees.map((e) => [e.employeeId, e.name]));
  const toggleDay = (d: number) => setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d].sort()));
  const toggleEmp = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const submit = async () => {
    try {
      setBusy(true);
      const result = mode === "pattern" ? await scheduleApi.applyPattern(patternParams) : await scheduleApi.fill(singleFill());
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

          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="single">{t("schedule:quickFill.modeSingle")}</TabsTrigger>
              <TabsTrigger value="pattern">{t("schedule:quickFill.modePattern")}</TabsTrigger>
            </TabsList>

            <TabsContent value="single" className="space-y-4 pt-2">
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
            </TabsContent>

            <TabsContent value="pattern" className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">{t("schedule:pattern.description")}</p>
              <div className="space-y-1">
                <Label>{t("schedule:pattern.anchor")}</Label>
                <Input type="date" className="w-48" value={anchor} onChange={(e) => setAnchor(e.target.value)} />
                <p className="text-xs text-muted-foreground">{t("schedule:pattern.anchorHint")}</p>
              </div>
              <PatternBuilder shiftTypes={shiftTypes} pattern={pattern} onChange={setPattern} anchor={anchor} />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>{t("schedule:pattern.groupSize")}</Label>
                  <Input type="number" min={1} placeholder={t("schedule:pattern.groupSizeAll")} value={groupSize} onChange={(e) => setGroupSize(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>{t("schedule:pattern.offsetStep")}</Label>
                  <Input type="number" min={0} max={55} value={offsetStep} onChange={(e) => setOffsetStep(e.target.value)} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{t("schedule:pattern.groupHint")}</p>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox checked={skipExisting} onCheckedChange={(v) => setSkipExisting(v === true)} />
                {t("schedule:pattern.skipExisting")}
              </label>
            </TabsContent>
          </Tabs>
        </div>
        <FillPreviewBox preview={preview} loading={previewing} names={names} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common:actions.cancel")}</Button>
          <Button disabled={busy || !ready} onClick={submit}>{t("common:actions.confirm")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QuickFillDialog;
