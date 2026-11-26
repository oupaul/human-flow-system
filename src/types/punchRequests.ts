export type RequestStatus = "pending" | "approved" | "rejected";

export interface CorrectionRequest {
  id: number;
  employeeId: string;
  employeeName?: string | null;
  department?: string | null;
  workDate: string;
  type: "in" | "out";
  requestedTime: string;
  reason: string;
  status: RequestStatus;
  reviewable?: boolean;
  reviewBlock?: string | null;
  reviewer: string | null;
  reviewNote: string | null;
}

export interface OutingRequest {
  id: number;
  employeeId: string;
  employeeName?: string | null;
  department?: string | null;
  startDate: string;
  endDate: string;
  destination: string;
  reason: string | null;
  status: RequestStatus;
  reviewable?: boolean;
  reviewBlock?: string | null;
  reviewer: string | null;
  reviewNote: string | null;
}

export interface PunchException {
  id: number;
  employeeId: string;
  employeeName: string | null;
  department: string | null;
  workDate: string;
  kind: "no_punch" | "missing_in" | "missing_out";
  currentKind: "no_punch" | "missing_in" | "missing_out" | null;
  resolved: boolean;
  resolvedBy: string | null;
  hasPendingRequest: boolean;
}

export interface ComplianceEntry {
  employeeId: string;
  name: string | null;
  department: string | null;
  issues: { type: "daily_hours" | "consecutive_days" | "no_regular_off" | "monthly_overtime"; detail: string }[];
}
