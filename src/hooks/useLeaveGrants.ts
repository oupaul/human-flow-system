import { useState, useEffect } from "react";
import { toast } from "sonner";
import { LeaveGrant, LeaveGrantFormData } from "@/types/leaveGrant";
import { leaveGrantApi } from "@/services/leaveGrantApi";

export const useLeaveGrants = () => {
  const [leaveGrants, setLeaveGrants] = useState<LeaveGrant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLeaveGrants();
  }, []);

  const loadLeaveGrants = async () => {
    try {
      setLoading(true);
      const data = await leaveGrantApi.getLeaveGrants();
      setLeaveGrants(data);
    } catch (error) {
      console.error("Failed to load leave grants:", error);
      toast.error("載入假別核給紀錄失敗", {
        description: "請檢查網路連線或聯繫系統管理員",
      });
    } finally {
      setLoading(false);
    }
  };

  const createLeaveGrant = async (data: LeaveGrantFormData) => {
    try {
      await leaveGrantApi.createLeaveGrant(data);
      await loadLeaveGrants();
      toast.success("核給成功", {
        description: `已核給 ${data.totalDays} 天，員工後續請假申請將自動從這筆核給扣抵。`,
      });
    } catch (error) {
      console.error("Failed to create leave grant:", error);
      toast.error("核給失敗", {
        description: error instanceof Error ? error.message : "請檢查網路連線或聯繫系統管理員",
      });
    }
  };

  const deleteLeaveGrant = async (id: number) => {
    try {
      await leaveGrantApi.deleteLeaveGrant(id);
      await loadLeaveGrants();
      toast.success("核給紀錄已刪除");
    } catch (error) {
      console.error("Failed to delete leave grant:", error);
      toast.error("刪除失敗", {
        description: error instanceof Error ? error.message : "請檢查網路連線或聯繫系統管理員",
      });
    }
  };

  return {
    leaveGrants,
    loading,
    createLeaveGrant,
    deleteLeaveGrant,
    reload: loadLeaveGrants,
  };
};
