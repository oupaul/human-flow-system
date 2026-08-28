export interface LeaveGrant {
  id: number;
  employeeId: string;
  employee: string;
  leaveTypeId: number;
  leaveTypeName: string;
  totalDays: number;
  usedDays: number;
  deadline: string | null;
  note: string | null;
  createdBy: string | null;
  created_at: string;
}

export interface LeaveGrantFormData {
  employeeId: string;
  leaveTypeId: number;
  totalDays: number;
  deadline?: string;
  note?: string;
}
