import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { CheckCircle2, ChevronDown, ChevronUp, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import IssueLine from "@/components/schedule/IssueLine";
import { ScheduleEmployee, ScheduleIssue } from "@/types/schedule";

interface Props {
  issues: ScheduleIssue[];
  employees: ScheduleEmployee[];
  onFocus: (employeeId: string) => void;
}

// 班表上方的檢查摘要：有幾位員工、幾項警示；展開可看明細，點一項會跳到那位員工
const SchedulePanel = ({ issues, employees, onFocus }: Props) => {
  const { t } = useTranslation("schedule");
  const [open, setOpen] = useState(false);
  const names = useMemo(() => new Map(employees.map((e) => [e.employeeId, e.name])), [employees]);
  const warnings = issues.filter((i) => i.severity === "warning");
  const infos = issues.filter((i) => i.severity === "info");
  const affected = new Set(issues.map((i) => i.employeeId)).size;

  return (
    <div className={`rounded-md border p-3 text-sm ${warnings.length > 0 ? "border-red-200 bg-red-50/50" : "bg-white"}`}>
      <div className="flex flex-wrap items-center gap-3">
        {warnings.length > 0 ? <ShieldAlert className="h-4 w-4 text-red-600" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
        <span className="font-medium">{t("check.title")}</span>
        <span className={issues.length === 0 ? "text-emerald-700" : ""}>
          {issues.length === 0 ? t("check.none") : t("check.summary", { employees: affected, warnings: warnings.length, infos: infos.length })}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="link" size="sm" className="h-auto p-0"><Link to="/punch">{t("check.actualLink")}</Link></Button>
          {issues.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setOpen(!open)}>
              {open ? <ChevronUp className="mr-1 h-4 w-4" /> : <ChevronDown className="mr-1 h-4 w-4" />}
              {open ? t("check.collapse") : t("check.expand")}
            </Button>
          )}
        </div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{t("check.hint")}</p>
      {employees.some((e) => e.workTimeMode !== "standard") && <p className="mt-1 text-xs text-violet-700">{t("check.cycleHint")}</p>}
      {open && (
        <ul className="mt-3 max-h-72 space-y-1 overflow-y-auto">
          {issues.map((i, idx) => (
            <li key={idx}>
              <button type="button" onClick={() => onFocus(i.employeeId)} className="w-full rounded px-2 py-1 text-left hover:bg-white">
                <span className="mr-2 font-medium">{names.get(i.employeeId) ?? i.employeeId}</span>
                <IssueLine issue={i} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SchedulePanel;
