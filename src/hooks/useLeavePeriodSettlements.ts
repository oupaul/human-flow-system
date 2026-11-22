import { useState, useEffect } from "react";
import { toast } from "sonner";
import { PendingLeavePeriodSettlement } from "@/types/leavePeriod";
import { leavePeriodApi } from "@/services/leavePeriodApi";

export const useLeavePeriodSettlements = () => {
  const [pendingSettlements, setPendingSettlements] = useState<PendingLeavePeriodSettlement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPendingSettlements();
  }, []);

  const loadPendingSettlements = async () => {
    try {
      setLoading(true);
      const data = await leavePeriodApi.getPendingSettlements();
      setPendingSettlements(data);
    } catch (error) {
      console.error("Failed to load pending leave period settlements:", error);
      toast.error("載入待結算特休週年清單失敗", {
        description: "請檢查網路連線或聯繫系統管理員",
      });
    } finally {
      setLoading(false);
    }
  };

  const settlePeriod = async (id: number, carryOverDays: number) => {
    try {
      const result = await leavePeriodApi.settlePeriod(id, carryOverDays);
      await loadPendingSettlements();
      toast.success("結算完成", {
        description: `應折現 ${result.cashOutDays} 天${result.cashOutAmount != null ? `，折現金額 NT$${result.cashOutAmount.toLocaleString()}` : ""}，遞延 ${result.carriedOutDays} 天到下一期。${result.warning ? ` ${result.warning}` : ""}`,
        duration: 15000,
      });
    } catch (error) {
      console.error("Failed to settle leave period:", error);
      toast.error("結算失敗", {
        description: error instanceof Error ? error.message : "請檢查網路連線或聯繫系統管理員",
      });
    }
  };

  return {
    pendingSettlements,
    loading,
    settlePeriod,
    reload: loadPendingSettlements,
  };
};
