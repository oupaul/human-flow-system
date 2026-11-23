import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OFF_CLASS, OFF_SHORT, SHIFT_CLASSES } from "@/components/schedule/scheduleStyles";
import { OffType, PatternStep, ShiftType } from "@/types/schedule";

const MAX_LENGTH = 56;
const OFF_TYPES: OffType[] = ["rest_day", "regular_off", "national_holiday"];

interface Props {
  shiftTypes: ShiftType[];
  pattern: PatternStep[];
  onChange: (pattern: PatternStep[]) => void;
  anchor: string;
}

const weekdayOf = (anchor: string, index: number) => {
  if (!anchor) return null;
  const d = new Date(`${anchor}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + index);
  return d.getUTCDay() === 0 ? 7 : d.getUTCDay();
};

// 輪替樣式編輯器：先選一支「筆刷」（班別／排休／不動），再點格子上色
const PatternBuilder = ({ shiftTypes, pattern, onChange, anchor }: Props) => {
  const { t } = useTranslation("schedule");
  const active = shiftTypes.filter((s) => s.active);
  const [brush, setBrush] = useState<PatternStep>(active[0] ? { kind: "shift", shiftTypeId: active[0].id } : { kind: "skip" });

  const sameStep = (a: PatternStep, b: PatternStep) =>
    a.kind === b.kind && (a.kind === "shift" ? a.shiftTypeId === (b as typeof a).shiftTypeId : a.kind === "off" ? a.offType === (b as typeof a).offType : true);

  const render = (step: PatternStep) => {
    if (step.kind === "off") return { text: OFF_SHORT[step.offType], cls: OFF_CLASS[step.offType] };
    if (step.kind === "shift") {
      const index = Math.max(0, active.findIndex((s) => s.id === step.shiftTypeId));
      return { text: shiftTypes.find((s) => s.id === step.shiftTypeId)?.label ?? "?", cls: SHIFT_CLASSES[index % SHIFT_CLASSES.length] };
    }
    return { text: "—", cls: "border border-dashed text-muted-foreground" };
  };

  const setLength = (value: number) => {
    const n = Math.min(MAX_LENGTH, Math.max(1, Math.floor(value) || 1));
    onChange(n >= pattern.length ? [...pattern, ...Array.from({ length: n - pattern.length }, (): PatternStep => ({ kind: "skip" }))] : pattern.slice(0, n));
  };

  const weekPreset = () => {
    const work: PatternStep = brush.kind === "shift" ? brush : active[0] ? { kind: "shift", shiftTypeId: active[0].id } : { kind: "skip" };
    onChange([work, work, work, work, work, { kind: "off", offType: "rest_day" }, { kind: "off", offType: "regular_off" }]);
  };

  const brushes: { step: PatternStep; label: string }[] = [
    ...active.map((s) => ({ step: { kind: "shift", shiftTypeId: s.id } as PatternStep, label: s.name })),
    ...OFF_TYPES.map((k) => ({ step: { kind: "off", offType: k } as PatternStep, label: t(`off.${k}`) })),
    { step: { kind: "skip" }, label: t("pattern.skip") },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label>{t("pattern.length")}</Label>
          <Input type="number" min={1} max={MAX_LENGTH} className="w-24" value={pattern.length} onChange={(e) => setLength(Number(e.target.value))} />
        </div>
        <Button type="button" size="sm" variant="outline" onClick={weekPreset}>{t("pattern.weekPreset")}</Button>
      </div>

      <div className="space-y-1">
        <Label>{t("pattern.brush")}</Label>
        <div className="flex flex-wrap gap-2">
          {brushes.map(({ step, label }, i) => {
            const r = render(step);
            return (
              <Button key={i} type="button" size="sm" variant={sameStep(brush, step) ? "default" : "outline"} onClick={() => setBrush(step)}>
                <span className={`mr-1.5 rounded px-1.5 text-xs ${r.cls}`}>{r.text}</span>{label}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {pattern.map((step, i) => {
          const r = render(step);
          const wd = weekdayOf(anchor, i);
          return (
            <button
              key={i}
              type="button"
              onClick={() => onChange(pattern.map((x, j) => (j === i ? brush : x)))}
              className="flex w-10 flex-col items-center gap-0.5 rounded border bg-white p-1 hover:bg-gray-50"
            >
              <span className="text-[10px] text-muted-foreground">{i + 1}</span>
              <span className={`flex h-7 w-8 items-center justify-center rounded text-xs ${r.cls}`}>{r.text}</span>
              <span className="text-[10px] text-muted-foreground">{wd ? t(`weekdays.${wd}`) : ""}</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">{t("pattern.hint")}</p>
    </div>
  );
};

export default PatternBuilder;
