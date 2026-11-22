import { apiFetch } from "@/lib/apiClient";
import { LeaveAdjustmentLog } from "@/types/leaveAdjustment";

export const leaveAdjustmentApi = {
  list(params: { q?: string; action?: string; limit?: number; offset?: number }): Promise<{ total: number; rows: LeaveAdjustmentLog[] }> {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.action && params.action !== "all") query.set("action", params.action);
    if (params.limit) query.set("limit", String(params.limit));
    if (params.offset) query.set("offset", String(params.offset));
    const qs = query.toString();
    return apiFetch(`/leave-adjustments${qs ? `?${qs}` : ""}`);
  },
};
