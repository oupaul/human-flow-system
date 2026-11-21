export type SeniorityBenefitType = "travel_subsidy" | "retention_bonus" | "other";
export type SeniorityBenefitRecordStatus = "pending" | "notified" | "paid" | "skipped";

export interface SeniorityBenefitRule {
  id: number;
  name: string;
  type: SeniorityBenefitType;
  startYears: number;
  repeatEveryYears: number | null;
  amount: number | null;
  remindDaysBefore: number;
  notifyHr: boolean;
  notifyEmployee: boolean;
  active: boolean;
  notes: string | null;
}

export type SeniorityBenefitRuleFormData = Omit<SeniorityBenefitRule, "id">;

export interface SeniorityBenefitRecord {
  id: number;
  ruleId: number;
  employeeId: string;
  eligibleDate: string;
  status: SeniorityBenefitRecordStatus;
  notifiedAt: string | null;
  paidAt: string | null;
  paidAmount: number | null;
  notes: string | null;
  employeeName: string | null;
  department: string | null;
  joinDate: string | null;
  ruleName: string;
  ruleType: SeniorityBenefitType;
  ruleAmount: number | null;
}

export interface SeniorityBenefitRecordUpdate {
  status: SeniorityBenefitRecordStatus;
  paidAt?: string | null;
  paidAmount?: number | null;
  notes?: string | null;
}

export interface SeniorityBenefitCheckResult {
  created: number;
  hrNotified: number;
  employeesNotified: number;
}
