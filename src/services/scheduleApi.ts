import { apiFetch, apiFetchBlob } from "@/lib/apiClient";
import { CellInput, ExcelPreview, MonthSchedule, OffType, PatternParams, PreviewResult, PreviewScenario, ScheduleCell, ShiftType } from "@/types/schedule";

type ShiftTypeBody = Pick<ShiftType, "name" | "shortName" | "startTime" | "endTime" | "breakMinutes" | "active">;

export const scheduleApi = {
  getMonth(month: string, department?: string): Promise<MonthSchedule> {
    const q = new URLSearchParams({ month });
    if (department) q.set("department", department);
    return apiFetch(`/schedule?${q.toString()}`);
  },
  getMine(from: string, to: string): Promise<ScheduleCell[]> {
    return apiFetch(`/schedule/mine?from=${from}&to=${to}`);
  },
  setCells(cells: CellInput[]): Promise<{ message: string; changed: number }> {
    return apiFetch("/schedule/cells", { method: "PUT", body: JSON.stringify({ cells }) });
  },
  fill(data: { employeeIds: string[]; from: string; to: string; weekdays: number[]; kind?: "shift" | "off"; shiftTypeId?: number; offType?: OffType; clear?: boolean }): Promise<{ message: string; changed: number }> {
    return apiFetch("/schedule/fill", { method: "POST", body: JSON.stringify(data) });
  },
  applyPattern(params: PatternParams): Promise<{ message: string; changed: number }> {
    return apiFetch("/schedule/pattern", { method: "POST", body: JSON.stringify(params) });
  },
  downloadExcel(month: string, department?: string): Promise<Blob> {
    const q = new URLSearchParams({ month });
    if (department) q.set("department", department);
    return apiFetchBlob(`/schedule/excel-template?${q.toString()}`);
  },
  previewExcel(file: File, month: string): Promise<ExcelPreview> {
    const form = new FormData();
    form.append("file", file);
    form.append("month", month);
    return apiFetch("/schedule/excel-preview", { method: "POST", body: form });
  },
  publish(month: string, department?: string): Promise<{ message: string; published: number }> {
    return apiFetch("/schedule/publish", { method: "POST", body: JSON.stringify({ month, department }) });
  },
  preview(scenarios: PreviewScenario[]): Promise<{ results: Record<string, PreviewResult> }> {
    return apiFetch("/schedule/preview", { method: "POST", body: JSON.stringify({ scenarios }) });
  },
  getShiftTypes(): Promise<ShiftType[]> {
    return apiFetch("/schedule/shift-types");
  },
  createShiftType(data: ShiftTypeBody): Promise<{ id: number }> {
    return apiFetch("/schedule/shift-types", { method: "POST", body: JSON.stringify(data) });
  },
  updateShiftType(id: number, data: ShiftTypeBody): Promise<{ message: string }> {
    return apiFetch(`/schedule/shift-types/${id}`, { method: "PUT", body: JSON.stringify(data) });
  },
  deleteShiftType(id: number): Promise<{ message: string }> {
    return apiFetch(`/schedule/shift-types/${id}`, { method: "DELETE" });
  },
};
