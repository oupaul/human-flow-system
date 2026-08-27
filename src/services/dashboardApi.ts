import { apiFetch } from "@/lib/apiClient";

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

export const dashboardApi = {
  async getDashboardStats(): Promise<DashboardStats> {
    return apiFetch<DashboardStats>("/dashboard/stats");
  },

  async getDepartmentAttendance(): Promise<DepartmentAttendance[]> {
    return apiFetch<DepartmentAttendance[]>("/dashboard/attendance");
  },

  async getLeaveDistribution(): Promise<LeaveDistribution[]> {
    return apiFetch<LeaveDistribution[]>("/dashboard/leaves");
  },
};
