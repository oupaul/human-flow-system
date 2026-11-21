export type HolidayDateSource = "holiday_name" | "manual";
export type HolidayBenefitStatus = "pending" | "notified" | "paid" | "skipped";

export interface HolidayBenefitRule {
  id: number;
  name: string;
  dateSource: HolidayDateSource;
  holidayKeyword: string | null;
  amount: number | null;
  remindDaysBefore: number;
  active: boolean;
  notes: string | null;
}

export type HolidayBenefitRuleFormData = Omit<HolidayBenefitRule, "id">;

export interface HolidayBenefitRecord {
  id: number;
  ruleId: number;
  year: number;
  eventDate: string;
  status: HolidayBenefitStatus;
  headcount: number | null;
  estimatedTotal: number | null;
  notifiedAt: string | null;
  paidAt: string | null;
  paidAmount: number | null;
  notes: string | null;
  ruleName: string;
  dateSource: HolidayDateSource;
  ruleAmount: number | null;
}

export interface HolidayBenefitRecordUpdate {
  status: HolidayBenefitStatus;
  eventDate?: string;
  paidAt?: string | null;
  paidAmount?: number | null;
  notes?: string | null;
}
