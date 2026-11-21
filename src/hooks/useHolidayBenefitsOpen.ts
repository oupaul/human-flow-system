import { useEffect, useState } from "react";
import { HolidayBenefitRecord } from "@/types/holidayBenefit";
import { holidayBenefitApi } from "@/services/holidayBenefitApi";

// Dashboard 用：載入「已提醒、尚未核發」的節日福利年度紀錄。enabled=false（無權限的角色）時不呼叫 API
export const useHolidayBenefitsOpen = (enabled: boolean) => {
  const [records, setRecords] = useState<HolidayBenefitRecord[]>([]);

  useEffect(() => {
    if (!enabled) return;
    holidayBenefitApi
      .getRecords()
      .then((data) => setRecords(data.filter((r) => r.status === "notified")))
      .catch((error) => {
        console.error("Failed to load holiday benefit records:", error);
        setRecords([]);
      });
  }, [enabled]);

  return records;
};
