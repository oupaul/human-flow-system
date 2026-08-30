import { AttendanceImportResult, AttendanceRecord, AttendanceSummaryRow } from "@/types/attendance";
import { apiFetch, apiFetchBlob } from "@/lib/apiClient";

export const attendanceApi = {
  async downloadImportTemplate(): Promise<Blob> {
    return apiFetchBlob("/attendance/import-template");
  },

  async importAttendance(file: File, year: number): Promise<AttendanceImportResult> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("year", String(year));
    return apiFetch<AttendanceImportResult>("/attendance/import", {
      method: "POST",
      body: formData,
    });
  },

  async getSummary(year: number, month: number): Promise<AttendanceSummaryRow[]> {
    return apiFetch<AttendanceSummaryRow[]>(`/attendance/summary?year=${year}&month=${month}`);
  },

  async getRecords(year: number, month: number, employeeId?: string): Promise<AttendanceRecord[]> {
    const query = employeeId ? `&employeeId=${encodeURIComponent(employeeId)}` : "";
    return apiFetch<AttendanceRecord[]>(`/attendance/records?year=${year}&month=${month}${query}`);
  },
};
