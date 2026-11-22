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
  salary: number;
  employeeTotal: number;
  employerTotal: number;
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
  warnings: string | null;
}

export interface PayrollSnapshotDetail extends Omit<PayrollSnapshotSummary, "salary" | "employeeTotal" | "employerTotal" | "totalCost"> {
  items: PayrollItem[];
  totals: { salary: number; employee: number; employer: number; totalCost: number };
}

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
