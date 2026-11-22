import { LeavePeriod, PendingLeavePeriodSettlement, SettleLeavePeriodResult } from "@/types/leavePeriod";
import { apiFetch } from "@/lib/apiClient";

export const leavePeriodApi = {
  async getLeavePeriods(employeeId?: string): Promise<LeavePeriod[]> {
    const query = employeeId ? `?employeeId=${encodeURIComponent(employeeId)}` : "";
    return apiFetch<LeavePeriod[]>(`/leave-periods${query}`);
  },

  async getPendingSettlements(): Promise<PendingLeavePeriodSettlement[]> {
    return apiFetch<PendingLeavePeriodSettlement[]>("/leave-periods/pending-settlement");
  },

  async settlePeriod(id: number, carryOverDays: number): Promise<SettleLeavePeriodResult> {
    return apiFetch<SettleLeavePeriodResult>(`/leave-periods/${id}/settle`, {
      method: "POST",
      body: JSON.stringify({ carryOverDays }),
    });
  },

  // 調整某一期的已用天數與／或上期遞延天數（遞延天數僅 admin/hr 可改）
  async adjustPeriod(id: number, data: { usedDays?: number; carriedInDays?: number }): Promise<LeavePeriod> {
    return apiFetch<LeavePeriod>(`/leave-periods/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },
};
