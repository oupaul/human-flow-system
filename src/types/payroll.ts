export type SnapshotStatus = "draft" | "locked";

export interface PayrollSnapshotSummary {
  id: number;
  month: string;
  status: SnapshotStatus;
  headcount: number;
  generatedAt: string | null;
  generatedBy: string | null;
  lockedAt: string | null;
  lockedBy: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  salary: number;
  overtimePay: number;
  leaveDeduction: number;
  employeeTotal: number;
  employerTotal: number;
  netTotal: number;
  totalCost: number;
}

export interface PayrollItem {
  id: number;
  employeeId: string;
  employeeName: string;
  department: string | null;
  monthlySalary: number | null;
  laborInsured: number | null;
  healthInsured: number | null;
  pensionWage: number | null;
  voluntaryPensionRate: number | null;
  healthDependents: number | null;
  laborEmployee: number | null;
  laborEmployer: number | null;
  healthEmployee: number | null;
  healthEmployer: number | null;
  pensionEmployer: number | null;
  pensionEmployee: number | null;
  overtimeHours: number | null;
  overtimePay: number | null;
  leaveDays: number | null;
  leaveDeduction: number | null;
  variableDetail: string | null;
  employeeInsurance: number | null;
  employerInsurance: number | null;
  grossPay: number | null;
  netPay: number | null;
  warnings: string | null;
}

export interface OvertimeDetailLine { id: number; date: string; hours: number; dayType: string; factor: number; amount: number }
export interface LeaveDetailLine { id: number; date: string; endDate: string; days: number; leaveType: string; ratio: number; amount: number }

export interface PayrollSnapshotDetail extends Omit<PayrollSnapshotSummary, "salary" | "overtimePay" | "leaveDeduction" | "employeeTotal" | "employerTotal" | "netTotal" | "totalCost"> {
  items: PayrollItem[];
  totals: { salary: number; overtimePay: number; leaveDeduction: number; gross: number; employee: number; employer: number; net: number; totalCost: number };
}

export interface PayrollSettings { cutoffDay: number; daysPerMonth: number; hoursPerDay: number }
export interface OvertimeRule { dayType: "weekday" | "rest_day" | "holiday"; fromHours: number; toHours: number | null; multiplier: number }
export interface LeaveDeduction { leaveTypeId: number; name: string; isPaid: boolean; deductRatio: number | null }
export interface PayrollRules { settings: PayrollSettings; overtimeRules: OvertimeRule[]; leaveDeductions: LeaveDeduction[] }

export interface InsuranceRate {
  effectiveDate: string;
  rateKey: string;
  value: number;
  note: string | null;
  label: string;
}

export interface BracketSet {
  effectiveDate: string;
  bracketType: "labor" | "health" | "pension";
  count: number;
  minAmount: number;
  maxAmount: number;
}
