import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Clock, Send, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import ShiftTypesDialog from "@/components/schedule/ShiftTypesDialog";
import QuickFillDialog from "@/components/schedule/QuickFillDialog";
import { useAuth } from "@/contexts/AuthContext";
import { scheduleApi } from "@/services/scheduleApi";
import { holidayApi } from "@/services/holidayApi";
import { departmentApi } from "@/services/departmentApi";
import { currentMonthStr } from "@/lib/taipeiDate";
import { CellInput, MonthSchedule, OffType, ScheduleCell } from "@/types/schedule";

const OFF_SHORT: Record<OffType, string> = { rest_day: "休", regular_off: "例", national_holiday: "國" };
const OFF_CLASS: Record<OffType, string> = {
  rest_day: "bg-sky-100 text-sky-800", regular_off: "bg-emerald-100 text-emerald-800", national_holiday: "bg-rose-100 text-rose-800",
};
const SHIFT_CLASSES = ["bg-amber-100 text-amber-900", "bg-violet-100 text-violet-900", "bg-teal-100 text-teal-900", "bg-orange-100 text-orange-900", "bg-indigo-100 text-indigo-900"];

const shiftMonth = (month: string, delta: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

// 月份班表：每人每天指派班別或排休。草稿也會被打卡與薪資使用，「發布」只決定員工看不看得到。
const Schedule = () => {
  const { t } = useTranslation(["schedule", "common"]);
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "hr";

  const [month, setMonth] = useState(currentMonthStr());
  const [department, setDepartment] = useState("all");
  const [mode, setMode] = useState("all");
  const [departments, setDepartments] = useState<string[]>([]);
  const [data, setData] = useState<MonthSchedule | null>(null);
  const [holidayNames, setHolidayNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const [shiftOpen, setShiftOpen] = useState(false);
  const [fillOpen, setFillOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [active, setActive] = useState<{ employeeId: string; name: string; date: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setData(await scheduleApi.getMonth(month, department === "all" ? undefined : department));
    } catch (error) {
      toast.error(t("common:common.loadFailed"), { description: error instanceof Error ? error.message : undefined });
    } finally {
      setLoading(false);
    }
  }, [month, department, t]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { departmentApi.getDepartments().then((d) => setDepartments(d.map((x) => x.name))).catch(() => undefined); }, []);
  useEffect(() => {
    holidayApi.getHolidays(Number(month.slice(0, 4))).then((list) => {
      const names: Record<string, string> = {};
      list.forEach((h) => { if (h.isHoliday && h.name) names[h.date] = h.name; });
      setHolidayNames(names);
    }).catch(() => setHolidayNames({}));
  }, [month]);

  const days = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    return Array.from({ length: new Date(y, m, 0).getDate() }, (_, i) => {
      const date = `${month}-${String(i + 1).padStart(2, "0")}`;
      return { date, day: i + 1, weekday: new Date(y, m - 1, i + 1).getDay() };
    });
  }, [month]);

  const cellMap = useMemo(() => {
    const map = new Map<string, ScheduleCell>();
    data?.rows.forEach((r) => map.set(`${r.employeeId}|${r.date}`, r));
    return map;
  }, [data]);

  const employees = (data?.employees ?? []).filter((e) =>
    mode === "all" ? true : mode === "rotating" ? e.scheduleMode === "rotating" : e.attendanceSource === "system");
  const shiftIndex = (id: number | null) => Math.max(0, (data?.shiftTypes ?? []).findIndex((s) => s.id === id));
  const unpublished = data?.rows.filter((r) => !r.published).length ?? 0;

  const apply = async (cell: CellInput) => {
    try {
      await scheduleApi.setCells([cell]);
      setActive(null);
      await load();
    } catch (error) {
      toast.error(t("common:common.saveFailed"), { description: error instanceof Error ? error.message : undefined });
    }
  };

  const publish = async () => {
    try {
      const result = await scheduleApi.publish(month, department === "all" ? undefined : department);
      toast.success(t("schedule:publish.done", { count: result.published }));
      setPublishOpen(false);
      await load();
    } catch (error) {
      toast.error(t("common:common.operationFailed"), { description: error instanceof Error ? error.message : undefined });
    }
  };

  const cellLabel = (c: ScheduleCell | undefined) => {
    if (!c) return "";
    if (c.kind === "off") return OFF_SHORT[c.offType as OffType];
    return (c.shiftName ?? "").slice(0, 1);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("common:nav.schedule")}</h1>
        <p className="text-sm text-muted-foreground">{t("schedule:page.description")}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="outline" onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft className="h-4 w-4" /></Button>
          <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="h-10 rounded-md border bg-white px-3 text-sm" />
          <Button size="icon" variant="outline" onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <Select value={department} onValueChange={setDepartment}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("schedule:page.allDepartments")}</SelectItem>
            {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={mode} onValueChange={setMode}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("schedule:page.modeAll")}</SelectItem>
            <SelectItem value="rotating">{t("schedule:page.modeRotating")}</SelectItem>
            <SelectItem value="system">{t("schedule:page.modeSystem")}</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={() => setShiftOpen(true)}><Clock className="mr-2 h-4 w-4" />{t("schedule:page.shiftTypes")}</Button>
          {canEdit && <Button variant="outline" onClick={() => setFillOpen(true)}><Wand2 className="mr-2 h-4 w-4" />{t("schedule:page.quickFill")}</Button>}
          {canEdit && <Button className="bg-hrms-accent" onClick={() => setPublishOpen(true)} disabled={unpublished === 0}><Send className="mr-2 h-4 w-4" />{t("schedule:page.publish")}{unpublished > 0 && `（${unpublished}）`}</Button>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {(data?.shiftTypes ?? []).filter((s) => s.active).map((s) => (
          <span key={s.id} className={`rounded px-2 py-0.5 ${SHIFT_CLASSES[shiftIndex(s.id) % SHIFT_CLASSES.length]}`}>{s.name.slice(0, 1)} {s.name} {s.startTime}~{s.endTime}</span>
        ))}
        {(Object.keys(OFF_SHORT) as OffType[]).map((k) => <span key={k} className={`rounded px-2 py-0.5 ${OFF_CLASS[k]}`}>{OFF_SHORT[k]} {t(`schedule:off.${k}`)}</span>)}
        <span className="text-muted-foreground">{t("schedule:page.legendHint")}</span>
      </div>

      <div className="overflow-x-auto rounded-md border bg-white">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 min-w-[150px] border-b bg-gray-50 px-2 py-2 text-left">{t("common:table.name")}</th>
              {days.map((d) => (
                <th key={d.date} title={holidayNames[d.date]} className={`min-w-[34px] border-b px-0.5 py-1 text-center font-normal ${holidayNames[d.date] ? "bg-rose-50 text-rose-700" : d.weekday === 0 || d.weekday === 6 ? "bg-gray-100" : "bg-gray-50"}`}>
                  <div>{d.day}</div>
                  <div className="text-[10px] text-muted-foreground">{t(`schedule:weekdays.${d.weekday === 0 ? 7 : d.weekday}`)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={days.length + 1} className="py-8 text-center">{t("common:common.loading")}</td></tr>
            ) : employees.length === 0 ? (
              <tr><td colSpan={days.length + 1} className="py-8 text-center text-muted-foreground">{t("schedule:page.empty")}</td></tr>
            ) : employees.map((e) => (
              <tr key={e.employeeId} className="border-b last:border-b-0">
                <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-2 py-1">
                  {e.name}<span className="ml-1 text-muted-foreground">{e.employeeId}</span>
                  {e.scheduleMode === "rotating" && <Badge variant="outline" className="ml-1 px-1 py-0 text-[10px]">{t("schedule:page.rotatingTag")}</Badge>}
                </td>
                {days.map((d) => {
                  const c = cellMap.get(`${e.employeeId}|${d.date}`);
                  const cls = c ? (c.kind === "off" ? OFF_CLASS[c.offType as OffType] : SHIFT_CLASSES[shiftIndex(c.shiftTypeId) % SHIFT_CLASSES.length]) : "";
                  return (
                    <td key={d.date} className="p-0.5 text-center">
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() => setActive({ employeeId: e.employeeId, name: e.name, date: d.date })}
                        title={c ? (c.kind === "off" ? t(`schedule:off.${c.offType}`) : `${c.shiftName} ${c.startTime}~${c.endTime}`) : undefined}
                        className={`h-7 w-8 rounded text-xs ${cls || "border border-dashed text-muted-foreground hover:bg-gray-50"} ${c && !c.published ? "ring-1 ring-amber-400" : ""} ${canEdit ? "" : "cursor-default"}`}
                      >
                        {cellLabel(c)}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">{t("schedule:page.draftHint")}</p>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{active?.name} · {active?.date}</DialogTitle>
            <DialogDescription>{active && holidayNames[active.date] ? `${holidayNames[active.date]} · ` : ""}{t("schedule:cell.choose")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {(data?.shiftTypes ?? []).filter((s) => s.active).map((s) => (
              <Button key={s.id} variant="outline" className="justify-start" onClick={() => active && apply({ employeeId: active.employeeId, date: active.date, kind: "shift", shiftTypeId: s.id })}>
                <span className={`mr-2 rounded px-1.5 ${SHIFT_CLASSES[shiftIndex(s.id) % SHIFT_CLASSES.length]}`}>{s.name.slice(0, 1)}</span>{s.name} {s.startTime}~{s.endTime}
              </Button>
            ))}
            {(Object.keys(OFF_SHORT) as OffType[]).map((k) => (
              <Button key={k} variant="outline" className="justify-start" onClick={() => active && apply({ employeeId: active.employeeId, date: active.date, kind: "off", offType: k })}>
                <span className={`mr-2 rounded px-1.5 ${OFF_CLASS[k]}`}>{OFF_SHORT[k]}</span>{t(`schedule:off.${k}`)}
              </Button>
            ))}
            <Button variant="ghost" className="justify-start text-muted-foreground" onClick={() => active && apply({ employeeId: active.employeeId, date: active.date, clear: true })}>{t("schedule:cell.clear")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ShiftTypesDialog open={shiftOpen} onOpenChange={setShiftOpen} canEdit={canEdit} onChanged={load} />
      <QuickFillDialog open={fillOpen} onOpenChange={setFillOpen} month={month} employees={employees} shiftTypes={data?.shiftTypes ?? []} onDone={load} />

      <AlertDialog open={publishOpen} onOpenChange={setPublishOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("schedule:publish.title", { month })}</AlertDialogTitle>
            <AlertDialogDescription>{t("schedule:publish.body", { count: unpublished })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common:actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={publish}>{t("common:actions.confirm")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Schedule;
