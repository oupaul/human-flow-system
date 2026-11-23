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
  workTimeMode: "standard" | "flex2w" | "flex4w" | "flex8w";
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

// 依需求人數自動排班：每個班別週一到週日各需幾人
export interface CoverageDemand { shiftTypeId: number; counts: number[] }
export interface CoverageParams {
  employeeIds: string[];
  from: string;
  to: string;
  demand: CoverageDemand[];
  holidayMode: "ignore" | "off";
  skipExisting: boolean;
}
export interface CoverageReport {
  shortageTotal: number;
  shortages: { date: string; shiftTypeId: number; required: number; missing: number }[];
  summary: { employeeId: string; workDays: number; weekendDays: number; shifts: Record<string, number> }[];
}

export interface PreviewResult {
  coverage?: CoverageReport;
  stats: { added: number; changed: number; unchanged: number };
  newCount: number;
  resolvedCount: number;
  newIssues: ScheduleIssue[];
  resolvedIssues: ScheduleIssue[];
  remainingIssues: ScheduleIssue[];
}

// 輪替樣式的一格：班別、排休，或「不動」（保留原本的班表）
export type PatternStep =
  | { kind: "shift"; shiftTypeId: number }
  | { kind: "off"; offType: OffType }
  | { kind: "skip" };

export interface PatternParams {
  employeeIds: string[];
  from: string;
  to: string;
  anchor: string;
  pattern: PatternStep[];
  groupSize: number;
  offsetStep: number;
  skipExisting: boolean;
  holidayMode?: "ignore" | "off" | "skip";
}

export interface ExcelPreview {
  cells: CellInput[];
  sheetName: string;
  matchedBy: "employeeId" | "name";
  errors: { row: number; message: string }[];
  errorTotal: number;
  employees: number;
  from: string;
  to: string;
  preview: PreviewResult | null;
}

export type PreviewScenario =
  | { key: string; cells: CellInput[] }
  | { key: string; pattern: PatternParams }
  | { key: string; coverage: CoverageParams }
  | { key: string; fill: { employeeIds: string[]; from: string; to: string; weekdays: number[]; kind?: "shift" | "off"; shiftTypeId?: number; offType?: OffType; clear?: boolean } };

export type CellInput =
  | { employeeId: string; date: string; clear: true }
  | { employeeId: string; date: string; kind: "shift"; shiftTypeId: number }
  | { employeeId: string; date: string; kind: "off"; offType: OffType };
