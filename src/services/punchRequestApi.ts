import { apiFetch } from "@/lib/apiClient";
import { ComplianceEntry, CorrectionRequest, OutingRequest, PunchException, RequestStatus } from "@/types/punchRequests";

const q = (params: Record<string, string | undefined>) => {
  const s = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) s.set(k, v); });
  const text = s.toString();
  return text ? `?${text}` : "";
};

export const punchRequestApi = {
  createCorrection(data: { workDate: string; type: "in" | "out"; time: string; reason: string }): Promise<{ message: string }> {
    return apiFetch("/punch-requests/correction", { method: "POST", body: JSON.stringify(data) });
  },
  listCorrections(params: { all?: boolean; status?: RequestStatus } = {}): Promise<CorrectionRequest[]> {
    return apiFetch(`/punch-requests/correction${q({ all: params.all ? "1" : undefined, status: params.status })}`);
  },
  reviewCorrection(id: number, action: "approve" | "reject", note?: string): Promise<{ message: string }> {
    return apiFetch(`/punch-requests/correction/${id}/review`, { method: "POST", body: JSON.stringify({ action, note }) });
  },
  createOuting(data: { startDate: string; endDate: string; destination: string; reason?: string }): Promise<{ message: string }> {
    return apiFetch("/punch-requests/outing", { method: "POST", body: JSON.stringify(data) });
  },
  listOutings(params: { all?: boolean; status?: RequestStatus } = {}): Promise<OutingRequest[]> {
    return apiFetch(`/punch-requests/outing${q({ all: params.all ? "1" : undefined, status: params.status })}`);
  },
  reviewOuting(id: number, action: "approve" | "reject", note?: string): Promise<{ message: string }> {
    return apiFetch(`/punch-requests/outing/${id}/review`, { method: "POST", body: JSON.stringify({ action, note }) });
  },
  getExceptions(params: { status?: "open" | "all"; from?: string } = {}): Promise<PunchException[]> {
    return apiFetch(`/attendance/exceptions${q(params)}`);
  },
  runDetection(): Promise<{ message: string; detected: number }> {
    return apiFetch("/attendance/exceptions/run", { method: "POST" });
  },
  getCompliance(month: string): Promise<ComplianceEntry[]> {
    return apiFetch(`/attendance/compliance?month=${month}`);
  },
};
