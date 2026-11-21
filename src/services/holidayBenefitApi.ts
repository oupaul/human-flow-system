import { apiFetch } from "@/lib/apiClient";
import {
  HolidayBenefitRecord,
  HolidayBenefitRecordUpdate,
  HolidayBenefitRule,
  HolidayBenefitRuleFormData,
} from "@/types/holidayBenefit";

export const holidayBenefitApi = {
  getRules(): Promise<HolidayBenefitRule[]> {
    return apiFetch<HolidayBenefitRule[]>("/holiday-benefits/rules");
  },
  createRule(data: HolidayBenefitRuleFormData): Promise<{ id: number; message: string }> {
    return apiFetch("/holiday-benefits/rules", { method: "POST", body: JSON.stringify(data) });
  },
  updateRule(id: number, data: HolidayBenefitRuleFormData): Promise<{ message: string }> {
    return apiFetch(`/holiday-benefits/rules/${id}`, { method: "PUT", body: JSON.stringify(data) });
  },
  deleteRule(id: number): Promise<{ message: string }> {
    return apiFetch(`/holiday-benefits/rules/${id}`, { method: "DELETE" });
  },
  getRecords(): Promise<HolidayBenefitRecord[]> {
    return apiFetch<HolidayBenefitRecord[]>("/holiday-benefits/records");
  },
  createRecord(ruleId: number, eventDate: string): Promise<{ id: number; message: string }> {
    return apiFetch("/holiday-benefits/records", { method: "POST", body: JSON.stringify({ ruleId, eventDate }) });
  },
  updateRecord(id: number, data: HolidayBenefitRecordUpdate): Promise<{ message: string }> {
    return apiFetch(`/holiday-benefits/records/${id}`, { method: "PUT", body: JSON.stringify(data) });
  },
  deleteRecord(id: number): Promise<{ message: string }> {
    return apiFetch(`/holiday-benefits/records/${id}`, { method: "DELETE" });
  },
  runCheck(): Promise<{ created: number; notified: number }> {
    return apiFetch("/holiday-benefits/check", { method: "POST" });
  },
};
