import { apiFetch, apiFetchBlob } from "@/lib/apiClient";
import { BracketSet, InsuranceRate, PayrollSnapshotDetail, PayrollSnapshotSummary } from "@/types/payroll";

export const payrollApi = {
  getRates(): Promise<{ rates: InsuranceRate[]; brackets: BracketSet[] }> {
    return apiFetch("/payroll/rates");
  },
  importRates(csv: string): Promise<{ message: string; imported: number }> {
    return apiFetch("/payroll/rates/import", { method: "POST", body: JSON.stringify({ csv }) });
  },
  importBrackets(csv: string): Promise<{ message: string; imported: number; sets: number }> {
    return apiFetch("/payroll/brackets/import", { method: "POST", body: JSON.stringify({ csv }) });
  },
  listSnapshots(): Promise<PayrollSnapshotSummary[]> {
    return apiFetch("/payroll/snapshots");
  },
  getSnapshot(month: string): Promise<PayrollSnapshotDetail> {
    return apiFetch(`/payroll/snapshots/${month}`);
  },
  generate(month: string): Promise<{ message: string; month: string; headcount: number; warnings: number }> {
    return apiFetch("/payroll/snapshots", { method: "POST", body: JSON.stringify({ month }) });
  },
  lock(month: string): Promise<{ message: string }> {
    return apiFetch(`/payroll/snapshots/${month}/lock`, { method: "POST" });
  },
  unlock(month: string): Promise<{ message: string }> {
    return apiFetch(`/payroll/snapshots/${month}/unlock`, { method: "POST" });
  },
  remove(month: string): Promise<{ message: string }> {
    return apiFetch(`/payroll/snapshots/${month}`, { method: "DELETE" });
  },
  exportXlsx(month: string): Promise<Blob> {
    return apiFetchBlob(`/payroll/snapshots/${month}/export`);
  },
};
