import { Department, DepartmentFormData } from "@/types/department";
import { apiFetch } from "@/lib/apiClient";

export const departmentApi = {
  async getDepartments(): Promise<Department[]> {
    const data = await apiFetch<Department[] | { data: Department[] }>("/departments");
    return Array.isArray(data) ? data : data.data;
  },

  async createDepartment(departmentData: DepartmentFormData): Promise<Department> {
    return apiFetch<Department>("/departments", {
      method: "POST",
      body: JSON.stringify(departmentData),
    });
  },

  async updateDepartment(id: number, departmentData: DepartmentFormData): Promise<Department> {
    return apiFetch<Department>(`/departments/${id}`, {
      method: "PUT",
      body: JSON.stringify(departmentData),
    });
  },

  async deleteDepartment(id: number): Promise<void> {
    await apiFetch<void>(`/departments/${id}`, {
      method: "DELETE",
    });
  },
};
