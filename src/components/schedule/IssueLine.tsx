import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { ScheduleIssue } from "@/types/schedule";

const issueRangeText = (i: ScheduleIssue) => (i.startDate === i.endDate ? i.startDate : `${i.startDate} ~ ${i.endDate}`);

// 一項排班警示：類別標籤＋說明＋日期範圍（說明文字依語言翻譯，數字來自後端的 params）
const IssueLine = ({ issue, showRange = true }: { issue: ScheduleIssue; showRange?: boolean }) => {
  const { t } = useTranslation("schedule");
  const isInfo = issue.severity === "info";
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <Badge variant="outline" className={isInfo ? "border-sky-300 text-sky-700" : "border-red-300 text-red-700"}>
        {isInfo ? `${t("check.info")}・` : ""}{t(`check.types.${issue.type}`)}
      </Badge>
      <span className="text-muted-foreground">{t(`check.detail.${issue.type}`, issue.params)}</span>
      {showRange && <span className="text-xs text-muted-foreground">（{issueRangeText(issue)}）</span>}
    </span>
  );
};

export default IssueLine;
