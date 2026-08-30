import { apiFetch } from "@/lib/apiClient";

interface DashboardStats {
  totalEmployees: number;
  monthlyLeaves: number;
  averageAttendance: number;
  pendingRequests: number;
  pendingLeaveRequests: number;
  pendingOvertimeRequests: number;
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

export const dashboardApi = {
  async getDashboardStats(): Promise<DashboardStats> {
    return apiFetch<DashboardStats>("/dashboard/stats");
  },

  async getDepartmentAttendance(startDate?: string, endDate?: string): Promise<DepartmentAttendance[]> {
    const query = startDate && endDate ? `?startDate=${startDate}&endDate=${endDate}` : "";
    return apiFetch<DepartmentAttendance[]>(`/dashboard/attendance${query}`);
  },

  async getLeaveDistribution(startDate?: string, endDate?: string): Promise<LeaveDistribution[]> {
    const query = startDate && endDate ? `?startDate=${startDate}&endDate=${endDate}` : "";
    return apiFetch<LeaveDistribution[]>(`/dashboard/leaves${query}`);
  },
};
