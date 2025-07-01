interface DashboardStats {
  totalEmployees: number;
  monthlyLeaves: number;
  averageAttendance: number;
  pendingRequests: number;
}

interface DepartmentAttendance {
  name: string;
  attendance: number;
}

interface LeaveDistribution {
  name: string;
  value: number;
  color: string;
}

const API_BASE_URL = "/api";

export const dashboardApi = {
  // 獲取統計資料
  async getDashboardStats(): Promise<DashboardStats> {
    try {
      const response = await fetch(`${API_BASE_URL}/dashboard/stats`, {
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
      console.error('Error fetching dashboard stats:', error);
      throw error;
    }
  },

  // 獲取部門出勤率
  async getDepartmentAttendance(): Promise<DepartmentAttendance[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/dashboard/attendance`, {
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
      console.error('Error fetching department attendance:', error);
      throw error;
    }
  },

  // 獲取請假分布
  async getLeaveDistribution(): Promise<LeaveDistribution[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/dashboard/leaves`, {
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
      console.error('Error fetching leave distribution:', error);
      throw error;
    }
  },
};
