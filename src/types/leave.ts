
export interface LeaveType {
  id: number;
  name: string;
  code: string;
  unit: string;
  needProof: boolean;
  affectAttendance: boolean;
  isPaid: boolean;
  maxDays: string;
  advanceApply: string;
  canSplit: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface LeaveApplication {
  id: number;
  employeeId: string;
  employee: string;
  type: string;
  grantId?: number | null;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  days: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approver?: string;
  reviewable?: boolean;
  reviewBlock?: string | null;
  reviewNote?: string | null;
  deputy?: string;
  attachment?: string;
  created_at?: string;
  updated_at?: string;
}

export interface LeaveBalance {
  id: number;
  employeeId: string;
  employee: string;
  activePeriodId: number | null;
  annualLeave: number;
  annualCarriedIn: number;
  annualLeaveUsed: number;
  sickLeave: number;
  sickLeaveUsed: number;
  compensatoryLeave: number;
  compensatoryLeaveUsed: number;
  compensatoryLeaveDeadline?: string | null;
  updated_at?: string;
}

export interface LeaveApplicationFormData {
  employeeId: string;
  leaveTypeId: number;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  unit: 'day' | 'halfDay' | 'hour';
  reason: string;
  deputy?: string;
  attachment?: File;
}
