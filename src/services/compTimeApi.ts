import { CompTimeGrant, PendingCompTimeSettlement, SettleCompTimeGrantResult } from "@/types/compTime";
import { apiFetch } from "@/lib/apiClient";

export const compTimeApi = {
  async getGrants(employeeId?: string): Promise<CompTimeGrant[]> {
    const query = employeeId ? `?employeeId=${encodeURIComponent(employeeId)}` : "";
    return apiFetch<CompTimeGrant[]>(`/comp-time-grants${query}`);
  },

  async getPendingSettlements(): Promise<PendingCompTimeSettlement[]> {
    return apiFetch<PendingCompTimeSettlement[]>("/comp-time-grants/pending-settlement");
  },

  async getExpiringSoon(days = 30): Promise<CompTimeGrant[]> {
    return apiFetch<CompTimeGrant[]>(`/comp-time-grants/expiring-soon?days=${days}`);
  },

  async settleGrant(id: number): Promise<SettleCompTimeGrantResult> {
    return apiFetch<SettleCompTimeGrantResult>(`/comp-time-grants/${id}/settle`, {
      method: "POST",
    });
  },
};
