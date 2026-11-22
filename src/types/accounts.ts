export type AccountRole = "admin" | "hr" | "manager" | "employee";
export const ACCOUNT_ROLES: AccountRole[] = ["admin", "hr", "manager", "employee"];

export interface Account {
  id: number;
  username: string;
  role: AccountRole;
  employeeId: string | null;
  employeeName: string | null;
  active: boolean;
  mustChangePassword: boolean;
  createdAt: string;
}

export type AccountAuditAction = "role_change" | "activate" | "deactivate" | "reset_password";

export interface AccountAuditLog {
  id: number;
  createdAt: string;
  targetUsername: string | null;
  action: AccountAuditAction;
  beforeValue: string | null;
  afterValue: string | null;
  actorUsername: string | null;
}
