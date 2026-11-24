export const AUDIT_CATEGORIES = ["login", "account", "employee", "leave", "schedule", "attendance", "payroll", "settings", "other"] as const;
export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

export interface AuditLog {
  id: number;
  createdAt: string;
  actorUsername: string | null;
  actorRole: string | null;
  category: AuditCategory;
  action: string;
  summary: string;
  targetId: string | null;
  statusCode: number | null;
  success: boolean;
  ip: string | null;
}

export interface AuditFilter {
  from?: string;
  to?: string;
  actor?: string;
  category?: string;
  success?: string;
  q?: string;
}
