
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

  const createLeaveApplication = async (applicationData: LeaveApplicationFormData) => {
    try {
      await leaveApi.createLeaveApplication(applicationData);
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

  const updateApplicationStatus = async (id: number, status: 'approved' | 'rejected', approver: string) => {
    try {
      await leaveApi.updateLeaveApplicationStatus(id, status, approver);
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

  return {
    leaveTypes,
    leaveApplications,
    leaveBalances,
    loading,
    createLeaveApplication,
    updateApplicationStatus,
    loadAllData,
  };
};
