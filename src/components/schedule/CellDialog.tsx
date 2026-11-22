import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { scheduleApi } from "@/services/scheduleApi";
import { CellInput, OffType, PreviewResult, ShiftType } from "@/types/schedule";

import { OFF_CLASS, OFF_SHORT, SHIFT_CLASSES } from "@/components/schedule/scheduleStyles";

interface Props {
  active: { employeeId: string; name: string; date: string } | null;
  holidayName?: string;
  shiftTypes: ShiftType[];
  shiftIndex: (id: number | null) => number;
  onApply: (cell: CellInput) => void;
  onClose: () => void;
}

const OFF_TYPES: OffType[] = ["rest_day", "regular_off", "national_holiday"];

// 選班別／排休的對話框。每個選項旁邊會先預覽「選了之後會新增或解除哪些排班警示」，由排班者自己決定
const CellDialog = ({ active, holidayName, shiftTypes, shiftIndex, onApply, onClose }: Props) => {
  const { t } = useTranslation(["schedule", "common"]);
  const [previews, setPreviews] = useState<Record<string, PreviewResult> | null>(null);

  useEffect(() => {
    setPreviews(null);
    if (!active) return;
    let cancelled = false;
    const base = { employeeId: active.employeeId, date: active.date };
    const scenarios = [
      ...shiftTypes.filter((s) => s.active).map((s) => ({ key: `shift:${s.id}`, cells: [{ ...base, kind: "shift" as const, shiftTypeId: s.id }] })),
      ...OFF_TYPES.map((k) => ({ key: `off:${k}`, cells: [{ ...base, kind: "off" as const, offType: k }] })),
      { key: "clear", cells: [{ ...base, clear: true as const }] },
    ];
    scheduleApi.preview(scenarios).then((r) => { if (!cancelled) setPreviews(r.results); }).catch(() => { if (!cancelled) setPreviews({}); });
    return () => { cancelled = true; };
  }, [active, shiftTypes]);

  const notes = (key: string) => {
    if (!previews) return <span className="text-xs font-normal text-muted-foreground">{t("schedule:check.preview.loading")}</span>;
    const p = previews[key];
    if (!p) return null;
    const shown = [...p.newIssues, ...p.remainingIssues];
    const warnings = shown.filter((i) => i.severity === "warning");
    const infos = shown.filter((i) => i.severity === "info");
    return (
      <>
        {warnings.map((i, idx) => (
          <span key={`w${idx}`} className="text-xs font-normal text-red-700" title={t(`schedule:check.detail.${i.type}`, i.params)}>
            ⚠ {t(`schedule:check.types.${i.type}`)}：{t(`schedule:check.detail.${i.type}`, i.params)}
          </span>
        ))}
        {infos.map((i, idx) => (
          <span key={`i${idx}`} className="text-xs font-normal text-sky-700">
            {t("schedule:check.info")}・{t(`schedule:check.detail.${i.type}`, i.params)}
          </span>
        ))}
        {p.resolvedIssues.length > 0 && (
          <span className="text-xs font-normal text-emerald-700">✓ {t("schedule:check.preview.resolves", { count: p.resolvedIssues.length })}</span>
        )}
      </>
    );
  };

  const option = (key: string, chip: React.ReactNode, label: string, cell: CellInput) => (
    <Button key={key} variant="outline" className="h-auto w-full flex-col items-start gap-1 whitespace-normal py-2 text-left" onClick={() => onApply(cell)}>
      <span className="flex items-center">{chip}{label}</span>
      {notes(key)}
    </Button>
  );

  return (
    <Dialog open={!!active} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{active?.name} · {active?.date}</DialogTitle>
          <DialogDescription>{holidayName ? `${holidayName} · ` : ""}{t("schedule:cell.choose")}</DialogDescription>
        </DialogHeader>
        {active && (
          <div className="grid gap-2">
            {shiftTypes.filter((s) => s.active).map((s) => option(
              `shift:${s.id}`,
              <span className={`mr-2 rounded px-1.5 ${SHIFT_CLASSES[shiftIndex(s.id) % SHIFT_CLASSES.length]}`}>{s.label}</span>,
              `${s.name} ${s.startTime}~${s.endTime}`,
              { employeeId: active.employeeId, date: active.date, kind: "shift", shiftTypeId: s.id },
            ))}
            {OFF_TYPES.map((k) => option(
              `off:${k}`,
              <span className={`mr-2 rounded px-1.5 ${OFF_CLASS[k]}`}>{OFF_SHORT[k]}</span>,
              t(`schedule:off.${k}`),
              { employeeId: active.employeeId, date: active.date, kind: "off", offType: k },
            ))}
            <Button variant="ghost" className="h-auto w-full flex-col items-start gap-1 whitespace-normal py-2 text-left text-muted-foreground" onClick={() => onApply({ employeeId: active.employeeId, date: active.date, clear: true })}>
              <span>{t("schedule:cell.clear")}</span>
              {notes("clear")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CellDialog;
