export type AttendanceStatus = "normal" | "missing" | "day_off" | "leave";

export interface AttendanceRecord {
  id: number;
  employeeId: string;
  employeeName: string;
  department: string;
  date: string;
  shiftStart: string | null;
  shiftEnd: string | null;
  clockIn: string | null;
  clockOut: string | null;
  status: AttendanceStatus;
  note: string | null;
  isLate: boolean | number;
  isEarlyLeave: boolean | number;
}

export interface AttendanceSummaryRow {
  employeeId: string;
  employeeName: string;
  department: string;
  totalDays: number;
  normalDays: number;
  missingDays: number;
  dayOffDays: number;
  leaveDays: number;
  lateCount: number;
  earlyLeaveCount: number;
}

export interface AttendanceImportResult {
  message: string;
  imported: number;
  unmatchedAccounts: string[];
}
