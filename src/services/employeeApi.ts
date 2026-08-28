import { Employee, EmployeeFormData } from "@/types/employee";
import { apiFetch } from "@/lib/apiClient";

export const employeeApi = {
  async getEmployees(): Promise<Employee[]> {
    return apiFetch<Employee[]>("/employees");
  },

  async createEmployee(employeeData: EmployeeFormData): Promise<Employee> {
    return apiFetch<Employee>("/employees", {
      method: "POST",
      body: JSON.stringify(employeeData),
    });
  },

  async updateEmployee(id: number, employeeData: EmployeeFormData): Promise<Employee> {
    return apiFetch<Employee>(`/employees/${id}`, {
      method: "PUT",
      body: JSON.stringify(employeeData),
    });
  },

  async deleteEmployee(id: number): Promise<void> {
    await apiFetch<void>(`/employees/${id}`, {
      method: "DELETE",
    });
  },

  async terminateEmployee(id: number, terminationData: { terminationDate: string; terminationReason: string }): Promise<Employee> {
    return apiFetch<Employee>(`/employees/${id}/terminate`, {
      method: "PUT",
      body: JSON.stringify(terminationData),
    });
  },

  async resetPassword(id: number): Promise<{ message: string; username: string; defaultPassword: string }> {
    return apiFetch<{ message: string; username: string; defaultPassword: string }>(`/employees/${id}/reset-password`, {
      method: "POST",
    });
  },

  async importEmployees(csv: string): Promise<ImportEmployeesResult> {
    return apiFetch<ImportEmployeesResult>("/employees/import", {
      method: "POST",
      body: JSON.stringify({ csv }),
    });
  },
};

export interface ImportEmployeesResult {
  message: string;
  created: number;
  failed: { row: number; employeeId: string; error: string }[];
}
