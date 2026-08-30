import { OvertimeApplication, OvertimeApplicationFormData } from "@/types/overtime";
import { apiFetch } from "@/lib/apiClient";

export const overtimeApi = {
  async getOvertimeApplications(year?: number): Promise<OvertimeApplication[]> {
    const query = year ? `?year=${year}` : "";
    return apiFetch<OvertimeApplication[]>(`/overtime-applications${query}`);
  },

  async createOvertimeApplication(data: OvertimeApplicationFormData): Promise<OvertimeApplication> {
    return apiFetch<OvertimeApplication>("/overtime-applications", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateOvertimeApplicationStatus(id: number, status: "approved" | "rejected", approver: string, reviewNote?: string): Promise<OvertimeApplication> {
    return apiFetch<OvertimeApplication>(`/overtime-applications/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status, approver, reviewNote }),
    });
  },
};
