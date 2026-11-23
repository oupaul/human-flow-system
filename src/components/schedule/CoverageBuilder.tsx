import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { ShiftType } from "@/types/schedule";

interface Props {
  shiftTypes: ShiftType[];
  demand: Record<number, string[]>; // shiftTypeId → 週一到週日各需幾人（字串，方便輸入）
  onChange: (demand: Record<number, string[]>) => void;
}

const emptyWeek = () => Array.from({ length: 7 }, () => "");

// 每個班別、每個星期需要幾人。空白＝0＝不排這個班
const CoverageBuilder = ({ shiftTypes, demand, onChange }: Props) => {
  const { t } = useTranslation("schedule");
  const active = shiftTypes.filter((s) => s.active);

  const set = (shiftTypeId: number, day: number, value: string) => {
    const row = [...(demand[shiftTypeId] ?? emptyWeek())];
    row[day] = value.replace(/[^0-9]/g, "").slice(0, 3);
    onChange({ ...demand, [shiftTypeId]: row });
  };
  // 一列全部填成同一個數字（用第一格當基準）
  const fillWeekdays = (shiftTypeId: number) => {
    const row = [...(demand[shiftTypeId] ?? emptyWeek())];
    onChange({ ...demand, [shiftTypeId]: row.map((_, i) => (i < 5 ? row[0] : row[i])) });
  };

  if (active.length === 0) return <p className="text-sm text-muted-foreground">{t("coverage.noShifts")}</p>;
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs">
          <tr>
            <th className="p-2 text-left">{t("coverage.shift")}</th>
            {[1, 2, 3, 4, 5, 6, 7].map((d) => <th key={d} className={`p-1 text-center ${d >= 6 ? "text-red-600" : ""}`}>{t(`weekdays.${d}`)}</th>)}
            <th className="p-1" />
          </tr>
        </thead>
        <tbody>
          {active.map((s) => (
            <tr key={s.id} className="border-t">
              <td className="p-2"><div className="font-medium">{s.label || s.name}</div><div className="text-xs text-muted-foreground">{s.startTime}~{s.endTime}</div></td>
              {Array.from({ length: 7 }, (_, i) => (
                <td key={i} className="p-1">
                  <Input inputMode="numeric" className="h-8 w-12 px-1 text-center" placeholder="0" value={demand[s.id]?.[i] ?? ""} onChange={(e) => set(s.id, i, e.target.value)} />
                </td>
              ))}
              <td className="p-1"><button type="button" className="whitespace-nowrap text-xs text-blue-600 hover:underline" onClick={() => fillWeekdays(s.id)}>{t("coverage.copyWeekdays")}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CoverageBuilder;
