import { Department, DepartmentFormData } from "@/types/department";

const API_BASE_URL = "http://localhost:3001/api";

// API 響應類型
interface ApiResponse<T> {
  data?: T;
  message?: string;
  error?: string;
}

export const departmentApi = {
  // 獲取所有部門
  async getDepartments(): Promise<Department[]> {
    try {
      console.log('Fetching departments from:', `${API_BASE_URL}/departments`);
      const response = await fetch(`${API_BASE_URL}/departments`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('Response status:', response.status);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Received departments data:', data);
      return data;
    } catch (error) {
      console.error('Error fetching departments:', error);
      throw error;
    }
  },

  // 新增部門
  async createDepartment(departmentData: DepartmentFormData): Promise<Department> {
    try {
      // 轉換欄位名稱為 snake_case
      const payload = {
        name: departmentData.name,
        lead_name: departmentData.leadName,
        parent_id: departmentData.parentId || null,
        description: departmentData.description || null,
      };
      const response = await fetch(`${API_BASE_URL}/departments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error creating department:', error);
      throw error;
    }
  },

  // 更新部門
  async updateDepartment(id: number, departmentData: DepartmentFormData): Promise<Department> {
    try {
      const response = await fetch(`${API_BASE_URL}/departments/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(departmentData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error updating department:', error);
      throw error;
    }
  },

  // 刪除部門
  async deleteDepartment(id: number): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/departments/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error deleting department:', error);
      throw error;
    }
  },
};
