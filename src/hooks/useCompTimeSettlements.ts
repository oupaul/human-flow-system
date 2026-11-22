import { useState, useEffect } from "react";
import { toast } from "sonner";
import { PendingCompTimeSettlement } from "@/types/compTime";
import { compTimeApi } from "@/services/compTimeApi";

export const useCompTimeSettlements = () => {
  const [pendingSettlements, setPendingSettlements] = useState<PendingCompTimeSettlement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPendingSettlements();
  }, []);

  const loadPendingSettlements = async () => {
    try {
      setLoading(true);
      const data = await compTimeApi.getPendingSettlements();
      setPendingSettlements(data);
    } catch (error) {
      console.error("Failed to load pending comp time settlements:", error);
      toast.error("載入待結算補休清單失敗", {
        description: "請檢查網路連線或聯繫系統管理員",
      });
    } finally {
      setLoading(false);
    }
  };

  const settleGrant = async (id: number) => {
    try {
      const result = await compTimeApi.settleGrant(id);
      await loadPendingSettlements();
      toast.success("結算完成", {
        description: `折算 ${result.cashOutHours} 小時${result.cashOutAmount != null ? `，折算金額 NT$${result.cashOutAmount.toLocaleString()}` : ""}。${result.warning ? ` ${result.warning}` : ""}`,
        duration: 15000,
      });
    } catch (error) {
      console.error("Failed to settle comp time grant:", error);
      toast.error("結算失敗", {
        description: error instanceof Error ? error.message : "請檢查網路連線或聯繫系統管理員",
      });
    }
  };

  return {
    pendingSettlements,
    loading,
    settleGrant,
    reload: loadPendingSettlements,
  };
};
