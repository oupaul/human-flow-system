import { apiFetch, apiFetchBlob } from "@/lib/apiClient";
import { AuditFilter, AuditLog } from "@/types/auditLog";

const toQuery = (filter: AuditFilter, extra: Record<string, string> = {}) => {
  const q = new URLSearchParams(extra);
  for (const [k, v] of Object.entries(filter)) if (v && v !== "all") q.set(k, v);
  return q.toString();
};

export const auditLogApi = {
  list(filter: AuditFilter, page: number, pageSize: number): Promise<{ rows: AuditLog[]; total: number; page: number; pageSize: number; retentionDays: number }> {
    return apiFetch(`/audit-logs?${toQuery(filter, { page: String(page), pageSize: String(pageSize) })}`);
  },
  exportCsv(filter: AuditFilter): Promise<Blob> {
    return apiFetchBlob(`/audit-logs/export?${toQuery(filter)}`);
  },
};
