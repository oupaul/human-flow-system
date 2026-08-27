export interface LeavePeriod {
  id: number;
  employeeId: string;
  employee: string;
  periodStart: string;
  periodEnd: string;
  grantedDays: number;
  carriedInDays: number;
  usedDays: number;
  settledAt: string | null;
  carriedOutDays: number | null;
  cashOutDays: number | null;
  cashOutAmount: number | null;
  monthlySalary?: number | null;
}

export interface PendingLeavePeriodSettlement extends LeavePeriod {
  mandatoryCashOutDays: number;
  remainingGrantDays: number;
}

export interface SettleLeavePeriodResult {
  message: string;
  cashOutDays: number;
  cashOutAmount: number | null;
  carriedOutDays: number;
  warning: string | null;
}
