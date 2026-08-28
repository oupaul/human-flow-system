import { useState, useEffect } from "react";
import { toast } from "sonner";
import { OvertimeApplication, OvertimeApplicationFormData } from "@/types/overtime";
import { overtimeApi } from "@/services/overtimeApi";

export const useOvertimeApplications = () => {
  const [overtimeApplications, setOvertimeApplications] = useState<OvertimeApplication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOvertimeApplications();
  }, []);

  const loadOvertimeApplications = async () => {
    try {
      setLoading(true);
      const data = await overtimeApi.getOvertimeApplications();
      setOvertimeApplications(data);
    } catch (error) {
      console.error("Failed to load overtime applications:", error);
      toast.error("載入加班申請失敗", {
        description: "請檢查網路連線或聯繫系統管理員",
      });
    } finally {
      setLoading(false);
    }
  };

  const createOvertimeApplication = async (data: OvertimeApplicationFormData) => {
    try {
      await overtimeApi.createOvertimeApplication(data);
      await loadOvertimeApplications();
      toast.success("加班申請已提交", {
        description: "您的加班申請已送出，等待主管審核。",
      });
    } catch (error) {
      console.error("Failed to create overtime application:", error);
      toast.error("加班申請失敗", {
        description: error instanceof Error ? error.message : "請檢查網路連線或聯繫系統管理員",
      });
    }
  };

  const updateOvertimeStatus = async (id: number, status: "approved" | "rejected", approver: string, reviewNote?: string) => {
    try {
      await overtimeApi.updateOvertimeApplicationStatus(id, status, approver, reviewNote);
      await loadOvertimeApplications();
      toast.success("審核狀態已更新", {
        description: `加班申請已${status === "approved" ? "核准" : "拒絕"}。`,
      });
    } catch (error) {
      console.error("Failed to update overtime status:", error);
      toast.error("審核狀態更新失敗", {
        description: "請檢查網路連線或聯繫系統管理員",
      });
    }
  };

  return {
    overtimeApplications,
    loading,
    createOvertimeApplication,
    updateOvertimeStatus,
    reload: loadOvertimeApplications,
  };
};
