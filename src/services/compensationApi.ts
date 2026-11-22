import { apiFetch } from "@/lib/apiClient";
import { Compensation, CompensationFormData } from "@/types/compensation";

export const compensationApi = {
  list(employeeId: string): Promise<Compensation[]> {
    return apiFetch<Compensation[]>(`/employees/${encodeURIComponent(employeeId)}/compensation`);
  },
  create(employeeId: string, data: CompensationFormData): Promise<{ id: number; message: string }> {
    return apiFetch(`/employees/${encodeURIComponent(employeeId)}/compensation`, { method: "POST", body: JSON.stringify(data) });
  },
  update(id: number, data: CompensationFormData): Promise<{ message: string }> {
    return apiFetch(`/compensation/${id}`, { method: "PUT", body: JSON.stringify(data) });
  },
  remove(id: number): Promise<{ message: string }> {
    return apiFetch(`/compensation/${id}`, { method: "DELETE" });
  },
};
