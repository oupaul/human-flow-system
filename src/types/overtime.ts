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
  compensationType: "pay" | "comp";
  compHours: number | null;
  status: "pending" | "approved" | "rejected";
  approver?: string;
  reviewable?: boolean;
  reviewBlock?: string | null;
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
  compensationType: "pay" | "comp";
}
