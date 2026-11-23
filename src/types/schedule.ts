export type OffType = "rest_day" | "regular_off" | "national_holiday";

export interface ShiftType {
  id: number;
  name: string;
  shortName: string;
  label: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  active: boolean;
  crossesMidnight: boolean;
}

export interface ScheduleCell {
  employeeId: string;
  date: string;
  kind: "shift" | "off";
  shiftTypeId: number | null;
  offType: OffType | null;
  published: boolean;
  shiftName: string | null;
  shiftLabel: string | null;
  startTime: string | null;
  endTime: string | null;
}

export interface ScheduleEmployee {
  employeeId: string;
  name: string;
  department: string;
  scheduleMode: "fixed" | "rotating" | null;
  attendanceSource: "import" | "system";
  workTimeMode: "standard" | "flex2w";
  workTimeCycleStart: string | null;
}

export type ScheduleIssueType =
  | "daily_hours" | "rest_interval" | "consecutive_days" | "no_regular_off" | "no_rest_day" | "weekly_hours"
  | "cycle_days_off" | "daily_normal_hours" | "cycle_hours";

export interface ScheduleIssue {
  employeeId: string;
  type: ScheduleIssueType;
  severity: "warning" | "info";
  startDate: string;
  endDate: string;
  params: { hours?: number; gapHours?: number; days?: number; limit?: number; count?: number; required?: number };
}

export interface MonthSchedule {
  employees: ScheduleEmployee[];
  rows: ScheduleCell[];
  shiftTypes: ShiftType[];
  warnings: ScheduleIssue[];
}

export interface PreviewResult {
  newIssues: ScheduleIssue[];
  resolvedIssues: ScheduleIssue[];
  remainingIssues: ScheduleIssue[];
}

export type PreviewScenario =
  | { key: string; cells: CellInput[] }
  | { key: string; fill: { employeeIds: string[]; from: string; to: string; weekdays: number[]; kind?: "shift" | "off"; shiftTypeId?: number; offType?: OffType; clear?: boolean } };

export type CellInput =
  | { employeeId: string; date: string; clear: true }
  | { employeeId: string; date: string; kind: "shift"; shiftTypeId: number }
  | { employeeId: string; date: string; kind: "off"; offType: OffType };
