export type PunchType = "in" | "out";

export interface PunchStatus {
  serverTime: string;
  today: string;
  ip: string;
  enabled: boolean;
  reason?: "NO_EMPLOYEE" | "NOT_ENABLED";
  name?: string;
  nextType?: PunchType;
  open?: boolean;
  lastPunchAt?: string | null;
  todayEvents?: { type: PunchType; time: string }[];
  ipAllowed?: boolean;
  deviceBinding?: "off" | "flag" | "enforce";
  deviceState?: "off" | "unknown" | "pending" | "approved" | "revoked" | "other";
}

export interface PunchEvent {
  id: number;
  employeeId: string;
  employeeName: string | null;
  punchAt: string;
  workDate: string;
  type: PunchType;
  source: "web" | "correction";
  ip: string | null;
  deviceLabel: string | null;
  flags: string | null;
  note: string | null;
  createdBy: string | null;
  status: "valid" | "voided";
  voidedBy: string | null;
  voidedAt: string | null;
  voidReason: string | null;
}

export interface TodayRow {
  employeeId: string;
  name: string;
  department: string;
  clockIn: string | null;
  clockOut: string | null;
  status: "normal" | "missing" | "day_off" | "leave" | null;
  note: string | null;
  late: boolean;
}

export interface AttendanceSettings {
  defaultShiftStart: string;
  defaultShiftEnd: string;
  ipAllowlist: string;
  deviceBinding: "off" | "flag" | "enforce";
  maxDevicesPerEmployee: number;
  autoApproveFirstDevice: boolean;
  yourIp?: string;
}

export interface PunchDevice {
  id: number;
  employeeId: string;
  employeeName: string | null;
  label: string | null;
  status: "pending" | "approved" | "revoked";
  firstSeenAt: string;
  lastSeenAt: string;
  lastIp: string | null;
  approvedBy: string | null;
}
