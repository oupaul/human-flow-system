import { apiFetch } from "@/lib/apiClient";
import {
  SeniorityBenefitCheckResult,
  SeniorityBenefitRecord,
  SeniorityBenefitRecordUpdate,
  SeniorityBenefitRule,
  SeniorityBenefitRuleFormData,
} from "@/types/seniorityBenefit";

export const seniorityBenefitApi = {
  getRules(): Promise<SeniorityBenefitRule[]> {
    return apiFetch<SeniorityBenefitRule[]>("/seniority-benefits/rules");
  },

  createRule(data: SeniorityBenefitRuleFormData): Promise<{ id: number; message: string }> {
    return apiFetch("/seniority-benefits/rules", { method: "POST", body: JSON.stringify(data) });
  },

  updateRule(id: number, data: SeniorityBenefitRuleFormData): Promise<{ message: string }> {
    return apiFetch(`/seniority-benefits/rules/${id}`, { method: "PUT", body: JSON.stringify(data) });
  },

  deleteRule(id: number): Promise<{ message: string }> {
    return apiFetch(`/seniority-benefits/rules/${id}`, { method: "DELETE" });
  },

  getRecords(): Promise<SeniorityBenefitRecord[]> {
    return apiFetch<SeniorityBenefitRecord[]>("/seniority-benefits/records");
  },

  updateRecord(id: number, data: SeniorityBenefitRecordUpdate): Promise<{ message: string }> {
    return apiFetch(`/seniority-benefits/records/${id}`, { method: "PUT", body: JSON.stringify(data) });
  },

  runCheck(): Promise<SeniorityBenefitCheckResult> {
    return apiFetch<SeniorityBenefitCheckResult>("/seniority-benefits/check", { method: "POST" });
  },
};
