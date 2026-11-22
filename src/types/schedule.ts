export type OffType = "rest_day" | "regular_off" | "national_holiday";

export interface ShiftType {
  id: number;
  name: string;
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
  startTime: string | null;
  endTime: string | null;
}

export interface ScheduleEmployee {
  employeeId: string;
  name: string;
  department: string;
  scheduleMode: "fixed" | "rotating" | null;
  attendanceSource: "import" | "system";
}

export interface MonthSchedule {
  employees: ScheduleEmployee[];
  rows: ScheduleCell[];
  shiftTypes: ShiftType[];
}

export type CellInput =
  | { employeeId: string; date: string; clear: true }
  | { employeeId: string; date: string; kind: "shift"; shiftTypeId: number }
  | { employeeId: string; date: string; kind: "off"; offType: OffType };
