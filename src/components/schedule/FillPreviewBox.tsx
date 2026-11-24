import { useTranslation } from "react-i18next";
import IssueLine from "@/components/schedule/IssueLine";
import { PreviewResult } from "@/types/schedule";

interface Props {
  preview: PreviewResult | null;
  loading: boolean;
  names: Map<string, string>;
  shiftNames?: Map<number, string>;
}

// 套用前的預覽：會新增／修改幾格，以及會新增或解除哪些排班警示（不會寫入）
const FillPreviewBox = ({ preview, loading, names, shiftNames }: Props) => {
  const { t } = useTranslation("schedule");
  if (!loading && !preview) return null;
  return (
    <div className="rounded-md border p-3 text-sm">
      {loading || !preview ? (
        <span className="text-muted-foreground">{t("check.preview.loading")}</span>
      ) : (
        <div className="space-y-1">
          <div className="font-medium">
            {t("check.preview.stats", { added: preview.stats.added, changed: preview.stats.changed, unchanged: preview.stats.unchanged })}
          </div>
          {preview.coverage && (
            <div className="rounded border bg-muted/40 p-2 text-xs">
              {preview.coverage.shortageTotal === 0
                ? <div className="text-emerald-700">{t("coverage.noShortage")}</div>
                : (
                  <>
                    <div className="font-medium text-red-700">{t("coverage.shortage", { count: preview.coverage.shortageTotal })}</div>
                    <ul className="max-h-24 overflow-y-auto">
                      {preview.coverage.shortages.slice(0, 12).map((s, i) => (
                        <li key={i}>{s.date.slice(5)} {shiftNames?.get(s.shiftTypeId) ?? s.shiftTypeId}：{t("coverage.missing", { missing: s.missing, required: s.required })}</li>
                      ))}
                    </ul>
                  </>
                )}
              {preview.coverage.summary.length > 0 && (
                <div className="mt-1 text-muted-foreground">
                  {t("coverage.workDays", { min: Math.min(...preview.coverage.summary.map((x) => x.workDays)), max: Math.max(...preview.coverage.summary.map((x) => x.workDays)) })}
                </div>
              )}
            </div>
          )}
          {preview.duty && (
            <div className="rounded border bg-muted/40 p-2 text-xs">
              <div>{t("duty.summary", { total: preview.duty.dutyTotal, min: preview.duty.minWork })}</div>
              <div className="mt-1 text-muted-foreground">
                {preview.duty.summary.map((x) => `${names.get(x.employeeId) ?? x.employeeId} ${x.duties}`).join("、")}
              </div>
              {preview.duty.dutyShortageTotal > 0 && <div className="mt-1 font-medium text-red-700">{t("duty.noOne", { count: preview.duty.dutyShortageTotal })}：{preview.duty.dutyShortages.slice(0, 6).map((x) => x.date.slice(5)).join("、")}</div>}
              {preview.duty.skipped.length > 0 && <div className="mt-1 text-amber-700">{t("duty.skipped", { count: preview.duty.skipped.length })}：{preview.duty.skipped.slice(0, 6).map((x) => `${x.date.slice(5)} ${names.get(x.employeeId) ?? x.employeeId}`).join("、")}</div>}
              {preview.duty.missingCompTotal > 0
                ? <div className="mt-1 font-medium text-red-700">{t("duty.missingComp", { count: preview.duty.missingCompTotal })}：{preview.duty.missingComp.slice(0, 6).map((x) => `${x.date.slice(5)} ${names.get(x.employeeId) ?? x.employeeId}`).join("、")}</div>
                : <div className="mt-1 text-emerald-700">{t("duty.allComp")}</div>}
              {preview.duty.lowHeadcountTotal > 0
                ? <div className="mt-1 font-medium text-red-700">{t("duty.low", { count: preview.duty.lowHeadcountTotal })}：{preview.duty.lowHeadcount.slice(0, 6).map((x) => `${x.date.slice(5)}（${x.working}）`).join("、")}</div>
                : <div className="mt-1 text-emerald-700">{t("duty.lowOk")}</div>}
              {preview.duty.compOutsideRange > 0 && <div className="mt-1 text-amber-700">{t("duty.outside", { count: preview.duty.compOutsideRange })}</div>}
              <div className="mt-1 text-muted-foreground">{t("duty.next", { name: names.get(preview.duty.nextEmployeeId) ?? preview.duty.nextEmployeeId })}</div>
            </div>
          )}
          {preview.newCount === 0 ? (
            <div className="text-emerald-700">{t("check.quickFill.clean")}</div>
          ) : (
            <>
              <div className="font-medium text-red-700">{t("check.quickFill.adds", { count: preview.newCount })}</div>
              <ul className="max-h-40 space-y-1 overflow-y-auto">
                {preview.newIssues.slice(0, 8).map((i, idx) => (
                  <li key={idx}><span className="mr-2 font-medium">{names.get(i.employeeId) ?? i.employeeId}</span><IssueLine issue={i} /></li>
                ))}
              </ul>
              {preview.newCount > 8 && <div className="text-xs text-muted-foreground">{t("check.quickFill.more", { count: preview.newCount - 8 })}</div>}
            </>
          )}
          {preview.resolvedCount > 0 && <div className="text-emerald-700">✓ {t("check.quickFill.resolves", { count: preview.resolvedCount })}</div>}
        </div>
      )}
    </div>
  );
};

export default FillPreviewBox;
