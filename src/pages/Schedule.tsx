import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Clock, FileSpreadsheet, Send, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import ShiftTypesDialog from "@/components/schedule/ShiftTypesDialog";
import QuickFillDialog from "@/components/schedule/QuickFillDialog";
import CellDialog from "@/components/schedule/CellDialog";
import { OFF_CLASS, OFF_SHORT, SHIFT_CLASSES } from "@/components/schedule/scheduleStyles";
import SchedulePanel from "@/components/schedule/SchedulePanel";
import ScheduleExcelDialog from "@/components/schedule/ScheduleExcelDialog";
import { useAuth } from "@/contexts/AuthContext";
import { scheduleApi } from "@/services/scheduleApi";
import { holidayApi } from "@/services/holidayApi";
import { departmentApi } from "@/services/departmentApi";
import { currentMonthStr } from "@/lib/taipeiDate";
import { CellInput, MonthSchedule, OffType, ScheduleCell, ScheduleIssue } from "@/types/schedule";

// 變形工時：二週／四週／八週的週期天數
const CYCLE_DAYS: Record<string, number> = { flex2w: 14, flex4w: 28, flex8w: 56 };
const CYCLE_WEEKS: Record<string, number> = { flex2w: 2, flex4w: 4, flex8w: 8 };

// 是否為週期的第一天（起算日起每 14／28／56 天一期）
const isCycleStart = (date: string, cycleStart: string | null, mode: string) => {
  if (!cycleStart || !CYCLE_DAYS[mode]) return false;
  const diff = (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${cycleStart}T00:00:00Z`)) / 86400000;
  return diff % CYCLE_DAYS[mode] === 0;
};

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
  const [excelOpen, setExcelOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [active, setActive] = useState<{ employeeId: string; name: string; date: string } | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [publishAck, setPublishAck] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);

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

  // 排班警示：只算畫面上看得到的員工；紅點只標「警示」，週工時提示只列在摘要裡
  const shownIds = useMemo(() => new Set(employees.map((e) => e.employeeId)), [employees]);
  const issues = useMemo(() => (data?.warnings ?? []).filter((i) => shownIds.has(i.employeeId)), [data, shownIds]);
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const cellIssues = useMemo(() => {
    const map = new Map<string, ScheduleIssue[]>();
    for (const i of issues) {
      if (i.severity !== "warning") continue;
      for (const d of days) {
        if (d.date < i.startDate || d.date > i.endDate) continue;
        const key = `${i.employeeId}|${d.date}`;
        map.set(key, [...(map.get(key) ?? []), i]);
      }
    }
    return map;
  }, [issues, days]);
  const rowWarnings = useMemo(() => {
    const map = new Map<string, ScheduleIssue[]>();
    for (const i of issues) if (i.severity === "warning") map.set(i.employeeId, [...(map.get(i.employeeId) ?? []), i]);
    return map;
  }, [issues]);

  const focusEmployee = (employeeId: string) => {
    setFocusId(employeeId);
    document.getElementById(`sched-row-${employeeId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => setFocusId((cur) => (cur === employeeId ? null : cur)), 3000);
  };

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
      setPublishAck(false);
      await load();
    } catch (error) {
      toast.error(t("common:common.operationFailed"), { description: error instanceof Error ? error.message : undefined });
    }
  };

  const clearDrafts = async () => {
    try {
      const result = await scheduleApi.clearUnpublished(month, department === "all" ? undefined : department);
      toast.success(t("schedule:clear.done", { count: result.deleted }));
      setClearOpen(false);
      await load();
    } catch (error) {
      toast.error(t("common:common.operationFailed"), { description: error instanceof Error ? error.message : undefined });
    }
  };

  const cellLabel = (c: ScheduleCell | undefined) => {
    if (!c) return "";
    if (c.kind === "off") return OFF_SHORT[c.offType as OffType];
    return c.shiftLabel ?? "";
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
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setShiftOpen(true)}><Clock className="mr-2 h-4 w-4" />{t("schedule:page.shiftTypes")}</Button>
          {canEdit && <Button variant="outline" onClick={() => setExcelOpen(true)}><FileSpreadsheet className="mr-2 h-4 w-4" />{t("schedule:page.excel")}</Button>}
          {canEdit && <Button variant="outline" onClick={() => setFillOpen(true)}><Wand2 className="mr-2 h-4 w-4" />{t("schedule:page.quickFill")}</Button>}
          {canEdit && <Button variant="outline" className="text-red-600 hover:text-red-700" onClick={() => setClearOpen(true)} disabled={unpublished === 0}><Trash2 className="mr-2 h-4 w-4" />{t("schedule:page.clear")}</Button>}
          {canEdit && <Button className="bg-hrms-accent" onClick={() => setPublishOpen(true)} disabled={unpublished === 0}><Send className="mr-2 h-4 w-4" />{t("schedule:page.publish")}{unpublished > 0 && `（${unpublished}）`}</Button>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {(data?.shiftTypes ?? []).filter((s) => s.active).map((s) => (
          <span key={s.id} className={`rounded px-2 py-0.5 ${SHIFT_CLASSES[shiftIndex(s.id) % SHIFT_CLASSES.length]}`}>{s.label} {s.name} {s.startTime}~{s.endTime}</span>
        ))}
        {(Object.keys(OFF_SHORT) as OffType[]).map((k) => <span key={k} className={`rounded px-2 py-0.5 ${OFF_CLASS[k]}`}>{OFF_SHORT[k]} {t(`schedule:off.${k}`)}</span>)}
        <span className="text-muted-foreground">{t("schedule:page.legendHint")}</span>
      </div>

      {!loading && data && <SchedulePanel issues={issues} employees={employees} onFocus={focusEmployee} />}

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
              <tr key={e.employeeId} id={`sched-row-${e.employeeId}`} className={`border-b last:border-b-0 ${focusId === e.employeeId ? "bg-amber-50" : ""}`}>
                <td className={`sticky left-0 z-10 whitespace-nowrap px-2 py-1 ${focusId === e.employeeId ? "bg-amber-50" : "bg-white"}`}>
                  {e.name}<span className="ml-1 text-muted-foreground">{e.employeeId}</span>
                  {e.scheduleMode === "rotating" && <Badge variant="outline" className="ml-1 px-1 py-0 text-[10px]">{t("schedule:page.rotatingTag")}</Badge>}
                  {e.workTimeMode !== "standard" && <Badge variant="outline" className="ml-1 border-violet-300 px-1 py-0 text-[10px] text-violet-700">{t("schedule:check.flexTag", { weeks: CYCLE_WEEKS[e.workTimeMode] })}</Badge>}
                  {rowWarnings.has(e.employeeId) && (
                    <Badge variant="outline" className="ml-1 border-red-300 px-1 py-0 text-[10px] text-red-700" title={(rowWarnings.get(e.employeeId) ?? []).map((i) => `${t(`schedule:check.types.${i.type}`)}：${t(`schedule:check.detail.${i.type}`, i.params)}（${i.startDate}~${i.endDate}）`).join("\n")}>
                      ⚠ {t("schedule:check.rowBadge", { count: rowWarnings.get(e.employeeId)?.length })}
                    </Badge>
                  )}
                </td>
                {days.map((d) => {
                  const c = cellMap.get(`${e.employeeId}|${d.date}`);
                  const flagged = cellIssues.get(`${e.employeeId}|${d.date}`);
                  const baseTitle = c ? (c.kind === "off" ? t(`schedule:off.${c.offType}`) : `${c.shiftName} ${c.startTime}~${c.endTime}`) : "";
                  const warnTitle = (flagged ?? []).map((i) => `⚠ ${t(`schedule:check.detail.${i.type}`, i.params)}`).join("\n");
                  const cls = c ? (c.kind === "off" ? OFF_CLASS[c.offType as OffType] : SHIFT_CLASSES[shiftIndex(c.shiftTypeId) % SHIFT_CLASSES.length]) : "";
                  return (
                    <td key={d.date} className={`p-0.5 text-center ${isCycleStart(d.date, e.workTimeCycleStart, e.workTimeMode) ? "border-l-2 border-l-violet-400" : ""}`}>
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() => setActive({ employeeId: e.employeeId, name: e.name, date: d.date })}
                        title={[baseTitle, warnTitle].filter(Boolean).join("\n") || undefined}
                        className={`relative h-7 w-8 rounded text-xs ${cls || "border border-dashed text-muted-foreground hover:bg-gray-50"} ${c && !c.published ? "ring-1 ring-amber-400" : ""} ${canEdit ? "" : "cursor-default"}`}
                      >
                        {cellLabel(c)}
                        {flagged && <span className="absolute right-0 top-0 h-2 w-2 rounded-full bg-red-500" />}
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

      <CellDialog
        active={active}
        holidayName={active ? holidayNames[active.date] : undefined}
        shiftTypes={data?.shiftTypes ?? []}
        shiftIndex={shiftIndex}
        onApply={apply}
        onClose={() => setActive(null)}
      />

      <ShiftTypesDialog open={shiftOpen} onOpenChange={setShiftOpen} canEdit={canEdit} onChanged={load} />
      <ScheduleExcelDialog open={excelOpen} onOpenChange={setExcelOpen} month={month} department={department} employees={employees} onDone={load} />
      <QuickFillDialog open={fillOpen} onOpenChange={setFillOpen} month={month} employees={employees} shiftTypes={data?.shiftTypes ?? []} onDone={load} />

      <AlertDialog open={publishOpen} onOpenChange={(o) => { setPublishOpen(o); if (!o) setPublishAck(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("schedule:publish.title", { month })}</AlertDialogTitle>
            <AlertDialogDescription>{t("schedule:publish.body", { count: unpublished })}</AlertDialogDescription>
          </AlertDialogHeader>
          {warningCount > 0 && (
            <div className="space-y-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm">
              <div className="font-medium text-red-700">{t("schedule:check.publish.title", { count: warningCount })}</div>
              <div className="text-xs text-muted-foreground">{t("schedule:check.publish.body")}</div>
              <label className="flex cursor-pointer items-start gap-2 text-xs">
                <Checkbox checked={publishAck} onCheckedChange={(v) => setPublishAck(v === true)} className="mt-0.5" />
                <span>{t("schedule:check.publish.confirm")}</span>
              </label>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common:actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={publish} disabled={warningCount > 0 && !publishAck}>{t("common:actions.confirm")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("schedule:clear.title", { month })}</AlertDialogTitle>
            <AlertDialogDescription>{t("schedule:clear.body", { count: unpublished, scope: department === "all" ? t("schedule:clear.scopeAll") : department })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common:actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={clearDrafts}>{t("schedule:clear.confirm")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Schedule;
