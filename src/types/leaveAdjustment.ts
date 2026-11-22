export type LeaveAdjustmentAction =
  | "annual_used" | "annual_carried_in" | "annual_granted" | "annual_settle"
  | "comp_settle" | "sick_balance" | "grant_create" | "grant_delete";

export interface LeaveAdjustmentLog {
  id: number;
  created_at: string;
  employeeId: string;
  employeeName: string | null;
  action: LeaveAdjustmentAction;
  refId: number | null;
  beforeValue: string | null;
  afterValue: string | null;
  detail: string | null;
  actorUsername: string | null;
  actorRole: string | null;
}
