import { useState, useEffect } from "react";
import { toast } from "sonner";
import { CompTimeGrant } from "@/types/compTime";
import { compTimeApi } from "@/services/compTimeApi";

export const useCompTimeGrants = (employeeId?: string) => {
  const [compTimeGrants, setCompTimeGrants] = useState<CompTimeGrant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCompTimeGrants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  const loadCompTimeGrants = async () => {
    try {
      setLoading(true);
      const data = await compTimeApi.getGrants(employeeId);
      setCompTimeGrants(data);
    } catch (error) {
      console.error("Failed to load comp time grants:", error);
      toast.error("載入補休額度失敗", {
        description: "請檢查網路連線或聯繫系統管理員",
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    compTimeGrants,
    loading,
    reload: loadCompTimeGrants,
  };
};
