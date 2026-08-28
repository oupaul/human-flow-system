import { LeaveGrant, LeaveGrantFormData } from "@/types/leaveGrant";
import { apiFetch } from "@/lib/apiClient";

export const leaveGrantApi = {
  async getLeaveGrants(employeeId?: string): Promise<LeaveGrant[]> {
    const query = employeeId ? `?employeeId=${encodeURIComponent(employeeId)}` : "";
    return apiFetch<LeaveGrant[]>(`/leave-grants${query}`);
  },

  async createLeaveGrant(data: LeaveGrantFormData): Promise<LeaveGrant> {
    return apiFetch<LeaveGrant>("/leave-grants", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async deleteLeaveGrant(id: number): Promise<void> {
    await apiFetch<void>(`/leave-grants/${id}`, {
      method: "DELETE",
    });
  },
};
