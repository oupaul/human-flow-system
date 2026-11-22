import { apiFetch } from "@/lib/apiClient";
import { Account, AccountAuditLog, AccountRole } from "@/types/accounts";

export const accountsApi = {
  list(): Promise<Account[]> {
    return apiFetch("/accounts");
  },
  update(id: number, data: { role?: AccountRole; active?: boolean }): Promise<{ message: string }> {
    return apiFetch(`/accounts/${id}`, { method: "PUT", body: JSON.stringify(data) });
  },
  resetPassword(id: number): Promise<{ message: string; username: string; temporaryPassword: string }> {
    return apiFetch(`/accounts/${id}/reset-password`, { method: "POST" });
  },
  audit(params: { q?: string; limit?: number; offset?: number }): Promise<{ total: number; rows: AccountAuditLog[] }> {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.limit) query.set("limit", String(params.limit));
    if (params.offset) query.set("offset", String(params.offset));
    const qs = query.toString();
    return apiFetch(`/accounts/audit${qs ? `?${qs}` : ""}`);
  },
};
