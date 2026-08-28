export interface OvertimeApplication {
  id: number;
  employeeId: string;
  employee: string;
  date: string;
  startTime: string;
  endTime: string;
  hours: number;
  reason: string;
  onHoliday: boolean;
  status: "pending" | "approved" | "rejected";
  approver?: string;
  reviewNote?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface OvertimeApplicationFormData {
  employeeId: string;
  date: string;
  startTime: string;
  endTime: string;
  reason: string;
}
