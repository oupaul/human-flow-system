export interface Compensation {
  id: number;
  employeeId: string;
  effectiveDate: string;
  monthlySalary: number;
  laborInsuredSalary: number | null;
  healthInsuredSalary: number | null;
  pensionWage: number | null;
  voluntaryPensionRate: number | null;
  healthDependents: number | null;
  notes: string | null;
  changedBy: string | null;
  updated_at?: string;
}

export type CompensationFormData = Omit<Compensation, "id" | "employeeId" | "changedBy" | "updated_at">;
