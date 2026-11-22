import { apiFetch } from "@/lib/apiClient";
import { PunchStats } from "@/types/punchStats";
import { AttendanceSettings, PunchDevice, PunchEvent, PunchStatus, PunchType, TodayRow } from "@/types/punch";

export const punchApi = {
  getStatus(): Promise<PunchStatus> {
    return apiFetch("/attendance/punch/status");
  },
  punch(type: PunchType): Promise<{ message: string; punchAt: string }> {
    return apiFetch("/attendance/punch", { method: "POST", body: JSON.stringify({ type }) });
  },
  getToday(): Promise<{ date: string; serverTime: string; shiftStart: string; rows: TodayRow[] }> {
    return apiFetch("/attendance/punch/today");
  },
  getEvents(params: { from?: string; to?: string; q?: string; status?: string; limit?: number; offset?: number }): Promise<{ total: number; rows: PunchEvent[] }> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== "" && v !== "all") query.set(k, String(v)); });
    return apiFetch(`/attendance/punch/events?${query.toString()}`);
  },
  voidEvent(id: number, reason: string): Promise<{ message: string }> {
    return apiFetch(`/attendance/punch/events/${id}/void`, { method: "POST", body: JSON.stringify({ reason }) });
  },
  correction(data: { employeeId: string; date: string; time: string; type: PunchType; reason: string }): Promise<{ message: string }> {
    return apiFetch("/attendance/punch/correction", { method: "POST", body: JSON.stringify(data) });
  },
  getStats(from: string, to: string): Promise<PunchStats> {
    return apiFetch(`/attendance/stats?from=${from}&to=${to}`);
  },
  getSettings(): Promise<AttendanceSettings> {
    return apiFetch("/attendance/settings");
  },
  saveSettings(data: AttendanceSettings): Promise<{ message: string }> {
    return apiFetch("/attendance/settings", { method: "PUT", body: JSON.stringify(data) });
  },
  getDevices(): Promise<PunchDevice[]> {
    return apiFetch("/attendance/devices");
  },
  setDevice(id: number, action: "approve" | "revoke"): Promise<{ message: string }> {
    return apiFetch(`/attendance/devices/${id}/${action}`, { method: "POST" });
  },
  setSource(data: { source: "import" | "system"; department?: string; employeeIds?: string[] }): Promise<{ message: string; updated: number }> {
    return apiFetch("/attendance/source", { method: "PUT", body: JSON.stringify(data) });
  },
};
