
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { Users, Calendar, Clock, Briefcase } from "lucide-react";
import { useState, useEffect } from "react";
import { dashboardApi } from "@/services/dashboardApi";
import { toast } from "sonner";

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

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [departmentAttendance, setDepartmentAttendance] = useState<DepartmentAttendance[]>([]);
  const [leaveDistribution, setLeaveDistribution] = useState<LeaveDistribution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsData, attendanceData, leaveData] = await Promise.all([
        dashboardApi.getDashboardStats(),
        dashboardApi.getDepartmentAttendance(),
        dashboardApi.getLeaveDistribution()
      ]);
      
      setStats(statsData);
      setDepartmentAttendance(attendanceData);
      setLeaveDistribution(leaveData);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      toast.error("載入 Dashboard 資料失敗", {
        description: "請檢查網路連線或聯繫系統管理員",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hrms-accent mx-auto"></div>
            <p className="mt-2 text-muted-foreground">載入中...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <div className="text-sm text-muted-foreground">
          資料更新時間: {new Date().toLocaleString('zh-TW')}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex flex-row items-center p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              <Users className="h-6 w-6 text-hrms-accent" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-muted-foreground">總員工數</p>
              <h3 className="text-2xl font-bold">{stats?.totalEmployees || 0}</h3>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex flex-row items-center p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <Calendar className="h-6 w-6 text-hrms-success" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-muted-foreground">本月請假數</p>
              <h3 className="text-2xl font-bold">{stats?.monthlyLeaves || 0}</h3>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex flex-row items-center p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
              <Clock className="h-6 w-6 text-hrms-warning" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-muted-foreground">平均出勤率</p>
              <h3 className="text-2xl font-bold">{stats?.averageAttendance || 0}%</h3>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex flex-row items-center p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
              <Briefcase className="h-6 w-6 text-purple-500" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-muted-foreground">待審核申請</p>
              <h3 className="text-2xl font-bold">{stats?.pendingRequests || 0}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>部門出勤率</CardTitle>
            <CardDescription>各部門本月平均出勤率分析</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={departmentAttendance}
                  margin={{
                    top: 20,
                    right: 30,
                    left: 20,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[75, 100]} />
                  <Tooltip />
                  <Bar dataKey="attendance" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>請假類型分布</CardTitle>
            <CardDescription>本月各類請假使用比例</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={leaveDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {leaveDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
