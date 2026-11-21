import { useEffect, useState } from "react";
import { SeniorityBenefitRecord } from "@/types/seniorityBenefit";
import { seniorityBenefitApi } from "@/services/seniorityBenefitApi";

// Dashboard 用：只載入「尚未處理」（待提醒／已提醒但未核發）的年資福利紀錄。
// enabled=false（無權限的角色）時不呼叫 API，避免 403
export const useSeniorityBenefitsOpen = (enabled: boolean) => {
  const [records, setRecords] = useState<SeniorityBenefitRecord[]>([]);

  useEffect(() => {
    if (!enabled) return;
    seniorityBenefitApi
      .getRecords()
      .then((data) => setRecords(data.filter((r) => r.status === "pending" || r.status === "notified")))
      .catch((error) => {
        console.error("Failed to load seniority benefit records:", error);
        setRecords([]);
      });
  }, [enabled]);

  return records;
};
