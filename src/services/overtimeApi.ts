import { OvertimeApplication, OvertimeApplicationFormData } from "@/types/overtime";
import { apiFetch } from "@/lib/apiClient";

export const overtimeApi = {
  async getOvertimeApplications(): Promise<OvertimeApplication[]> {
    return apiFetch<OvertimeApplication[]>("/overtime-applications");
  },

  async createOvertimeApplication(data: OvertimeApplicationFormData): Promise<OvertimeApplication> {
    return apiFetch<OvertimeApplication>("/overtime-applications", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateOvertimeApplicationStatus(id: number, status: "approved" | "rejected", approver: string): Promise<OvertimeApplication> {
    return apiFetch<OvertimeApplication>(`/overtime-applications/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status, approver }),
    });
  },
};
