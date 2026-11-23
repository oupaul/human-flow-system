import { useTranslation } from "react-i18next";
import IssueLine from "@/components/schedule/IssueLine";
import { PreviewResult } from "@/types/schedule";

interface Props {
  preview: PreviewResult | null;
  loading: boolean;
  names: Map<string, string>;
}

// 套用前的預覽：會新增／修改幾格，以及會新增或解除哪些排班警示（不會寫入）
const FillPreviewBox = ({ preview, loading, names }: Props) => {
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
