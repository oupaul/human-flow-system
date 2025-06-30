
import { Employee, EmployeeFormData } from "@/types/employee";

const API_BASE_URL = "http://localhost:3001/api";

// API 響應類型
interface ApiResponse<T> {
  data?: T;
  message?: string;
  error?: string;
}

export const employeeApi = {
  // 獲取所有員工
  async getEmployees(): Promise<Employee[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/employees`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching employees:', error);
      throw error;
    }
  },

  // 新增員工
  async createEmployee(employeeData: EmployeeFormData): Promise<Employee> {
    try {
      const response = await fetch(`${API_BASE_URL}/employees`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(employeeData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error creating employee:', error);
      throw error;
    }
  },

  // 更新員工
  async updateEmployee(id: number, employeeData: EmployeeFormData): Promise<Employee> {
    try {
      const response = await fetch(`${API_BASE_URL}/employees/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(employeeData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error updating employee:', error);
      throw error;
    }
  },

  // 刪除員工
  async deleteEmployee(id: number): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/employees/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error deleting employee:', error);
      throw error;
    }
  },

  // 員工離職
  async terminateEmployee(id: number, terminationData: { terminationDate: string; terminationReason: string }): Promise<Employee> {
    try {
      const response = await fetch(`${API_BASE_URL}/employees/${id}/terminate`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(terminationData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error terminating employee:', error);
      throw error;
    }
  },
};
