
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { LeaveType, LeaveApplication, LeaveBalance, LeaveApplicationFormData } from "@/types/leave";
import { leaveApi } from "@/services/leaveApi";

export const useLeaveManagement = () => {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [leaveApplications, setLeaveApplications] = useState<LeaveApplication[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [types, applications, balances] = await Promise.all([
        leaveApi.getLeaveTypes(),
        leaveApi.getLeaveApplications(),
        leaveApi.getLeaveBalances(),
      ]);
      
      setLeaveTypes(types);
      setLeaveApplications(applications);
      setLeaveBalances(balances);
    } catch (error) {
      console.error('Failed to load leave data:', error);
      toast.error("載入假別資料失敗", {
        description: "請檢查網路連線或聯繫系統管理員",
      });
    } finally {
      setLoading(false);
    }
  };

  const createLeaveApplication = async (applicationData: LeaveApplicationFormData, attachment?: File) => {
    try {
      const created = await leaveApi.createLeaveApplication(applicationData);
      if (attachment) {
        try {
          await leaveApi.uploadLeaveAttachment(created.id, attachment);
        } catch (uploadError) {
          console.error('Failed to upload leave attachment:', uploadError);
          toast.error("證明文件上傳失敗", {
            description: "請假申請已送出，但附件上傳失敗，請稍後重新上傳。",
          });
        }
      }
      await loadAllData();
      toast.success("請假申請成功", {
        description: "您的請假申請已提交，等待主管審核。",
      });
    } catch (error) {
      console.error('Failed to create leave application:', error);
      toast.error("請假申請失敗", {
        description: "請檢查網路連線或聯繫系統管理員",
      });
    }
  };

  const updateApplicationStatus = async (id: number, status: 'approved' | 'rejected', approver: string, days?: number) => {
    try {
      await leaveApi.updateLeaveApplicationStatus(id, status, approver, days);
      await loadAllData();
      toast.success("審核狀態已更新", {
        description: `請假申請已${status === 'approved' ? '核准' : '拒絕'}。`,
      });
    } catch (error) {
      console.error('Failed to update application status:', error);
      toast.error("審核狀態更新失敗", {
        description: "請檢查網路連線或聯繫系統管理員",
      });
    }
  };

  const recalculateAnnualLeave = async () => {
    try {
      const result = await leaveApi.recalculateAnnualLeave();
      await loadAllData();
      toast.success("特休天數已重新計算", {
        description: `已更新 ${result.updated} 位員工的特休餘額。`,
      });
    } catch (error) {
      console.error('Failed to recalculate annual leave:', error);
      toast.error("重新計算特休天數失敗", {
        description: "請檢查網路連線或聯繫系統管理員",
      });
    }
  };

  return {
    leaveTypes,
    leaveApplications,
    leaveBalances,
    loading,
    createLeaveApplication,
    updateApplicationStatus,
    recalculateAnnualLeave,
    loadAllData,
  };
};
