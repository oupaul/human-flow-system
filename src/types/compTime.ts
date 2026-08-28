export interface CompTimeGrant {
  id: number;
  employeeId: string;
  employee: string;
  overtimeApplicationId: number;
  overtimeDate: string;
  overtimeHours: number;
  hours: number;
  usedHours: number;
  deadline: string;
  settledAt: string | null;
  cashOutHours: number | null;
  cashOutAmount: number | null;
}

export interface PendingCompTimeSettlement extends CompTimeGrant {
  monthlySalary: number | null;
}

export interface SettleCompTimeGrantResult {
  message: string;
  cashOutHours: number;
  cashOutAmount: number | null;
  warning: string | null;
}
