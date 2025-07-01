import { LeaveType, LeaveApplication, LeaveBalance, LeaveApplicationFormData } from "@/types/leave";

const API_BASE_URL = "/api";

export const leaveApi = {
  // 假別類型管理
  async getLeaveTypes(): Promise<LeaveType[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/leave-types`, {
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
      console.error('Error fetching leave types:', error);
      throw error;
    }
  },

  // 請假申請管理
  async getLeaveApplications(): Promise<LeaveApplication[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/leave-applications`, {
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
      console.error('Error fetching leave applications:', error);
      throw error;
    }
  },

  async createLeaveApplication(applicationData: LeaveApplicationFormData): Promise<LeaveApplication> {
    try {
      const response = await fetch(`${API_BASE_URL}/leave-applications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(applicationData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error creating leave application:', error);
      throw error;
    }
  },

  async updateLeaveApplicationStatus(id: number, status: 'approved' | 'rejected', approver: string): Promise<LeaveApplication> {
    try {
      const response = await fetch(`${API_BASE_URL}/leave-applications/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status, approver }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error updating leave application status:', error);
      throw error;
    }
  },

  // 假別餘額管理
  async getLeaveBalances(): Promise<LeaveBalance[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/leave-balances`, {
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
      console.error('Error fetching leave balances:', error);
      throw error;
    }
  },

  async updateLeaveBalance(employeeId: string, balanceData: Partial<LeaveBalance>): Promise<LeaveBalance> {
    try {
      const response = await fetch(`${API_BASE_URL}/leave-balances/${employeeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(balanceData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error updating leave balance:', error);
      throw error;
    }
  },
};
