import { LeaveType, LeaveApplication, LeaveBalance, LeaveApplicationFormData } from "@/types/leave";
import { apiFetch, apiFetchBlob } from "@/lib/apiClient";

export const leaveApi = {
  // 假別類型管理
  async getLeaveTypes(): Promise<LeaveType[]> {
    return apiFetch<LeaveType[]>("/leave-types");
  },

  // 請假申請管理
  async getLeaveApplications(): Promise<LeaveApplication[]> {
    return apiFetch<LeaveApplication[]>("/leave-applications");
  },

  async createLeaveApplication(applicationData: LeaveApplicationFormData): Promise<LeaveApplication> {
    return apiFetch<LeaveApplication>("/leave-applications", {
      method: "POST",
      body: JSON.stringify(applicationData),
    });
  },

  async updateLeaveApplicationStatus(id: number, status: "approved" | "rejected", approver: string, days?: number, reviewNote?: string): Promise<LeaveApplication> {
    return apiFetch<LeaveApplication>(`/leave-applications/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status, approver, days, reviewNote }),
    });
  },

  async uploadLeaveAttachment(id: number, file: File): Promise<{ message: string }> {
    const formData = new FormData();
    formData.append("file", file);
    return apiFetch<{ message: string }>(`/leave-applications/${id}/attachment`, {
      method: "POST",
      body: formData,
    });
  },

  async downloadLeaveAttachment(id: number): Promise<Blob> {
    return apiFetchBlob(`/leave-applications/${id}/attachment`);
  },

  // 假別餘額管理
  async getLeaveBalances(): Promise<LeaveBalance[]> {
    return apiFetch<LeaveBalance[]>("/leave-balances");
  },

  async updateLeaveBalance(employeeId: string, balanceData: Partial<LeaveBalance>): Promise<LeaveBalance> {
    return apiFetch<LeaveBalance>(`/leave-balances/${employeeId}`, {
      method: "PUT",
      body: JSON.stringify(balanceData),
    });
  },

  // 依所有在職員工到職日重新計算特休天數
  async recalculateAnnualLeave(): Promise<{ message: string; updated: number }> {
    return apiFetch<{ message: string; updated: number }>("/leave-balances/recalculate", {
      method: "POST",
    });
  },
};
