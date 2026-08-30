
import { useTranslation } from "react-i18next";
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
import { Users, Calendar, Clock, Briefcase, AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { dashboardApi } from "@/services/dashboardApi";
import { useCompTimeExpiringSoon } from "@/hooks/useCompTimeExpiringSoon";
import { toast } from "sonner";

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

const Dashboard = () => {
  const { t } = useTranslation(["dashboard", "common"]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [departmentAttendance, setDepartmentAttendance] = useState<DepartmentAttendance[]>([]);
  const [leaveDistribution, setLeaveDistribution] = useState<LeaveDistribution[]>([]);
  const [loading, setLoading] = useState(true);
  const { expiringSoon } = useCompTimeExpiringSoon(30);

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
      toast.error(t("dashboard:loadErrorTitle"), {
        description: t("common:common.networkErrorHint"),
      });
    } finally {
      setLoading(false);
    }
  };

  // 待審核申請卡片：優先導向實際有待審核項目的分頁，避免使用者還要自行切換
  const pendingApprovalLink =
    (stats?.pendingLeaveRequests ?? 0) > 0
      ? "/leave-management"
      : (stats?.pendingOvertimeRequests ?? 0) > 0
      ? "/leave-management?tab=overtime"
      : "/leave-management";

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">{t("dashboard:title")}</h1>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hrms-accent mx-auto"></div>
            <p className="mt-2 text-muted-foreground">{t("common:common.loading")}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("dashboard:title")}</h1>
        <div className="text-sm text-muted-foreground">
          {t("dashboard:updatedAt", { time: new Date().toLocaleString('zh-TW') })}
        </div>
      </div>

      {/* 統計卡片：點擊直接跳到對應的功能頁面 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link to="/employees" className="block">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardContent className="flex flex-row items-center p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                <Users className="h-6 w-6 text-hrms-accent" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">{t("dashboard:stats.totalEmployees")}</p>
                <h3 className="text-2xl font-bold">{stats?.totalEmployees || 0}</h3>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/leave-management" className="block">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardContent className="flex flex-row items-center p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <Calendar className="h-6 w-6 text-hrms-success" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">{t("dashboard:stats.monthlyLeaves")}</p>
                <h3 className="text-2xl font-bold">{stats?.monthlyLeaves || 0}</h3>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/reports" className="block">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardContent className="flex flex-row items-center p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
                <Clock className="h-6 w-6 text-hrms-warning" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">{t("dashboard:stats.averageAttendance")}</p>
                <h3 className="text-2xl font-bold">{stats?.averageAttendance || 0}%</h3>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to={pendingApprovalLink} className="block">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardContent className="flex flex-row items-center p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
                <Briefcase className="h-6 w-6 text-purple-500" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">{t("dashboard:stats.pendingRequests")}</p>
                <h3 className="text-2xl font-bold">{stats?.pendingRequests || 0}</h3>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* 圖表：點擊跳到報表分析對應分頁 */}
      <div className="grid gap-6 md:grid-cols-2">
        <Link to="/reports" className="block">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle>{t("dashboard:charts.departmentAttendance.title")}</CardTitle>
              <CardDescription>{t("dashboard:charts.departmentAttendance.description")}</CardDescription>
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
        </Link>

        <Link to="/reports" className="block">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle>{t("dashboard:charts.leaveDistribution.title")}</CardTitle>
              <CardDescription>{t("dashboard:charts.leaveDistribution.description")}</CardDescription>
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
        </Link>
      </div>

      {expiringSoon.length > 0 && (
        <Link to="/leave-management?tab=settlement" className="block">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-hrms-warning" />
                <CardTitle>{t("dashboard:compExpiringSoon.title")}</CardTitle>
              </div>
              <CardDescription>{t("dashboard:compExpiringSoon.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {expiringSoon.slice(0, 5).map((grant) => (
                  <li key={grant.id} className="flex items-center justify-between border-b pb-2 last:border-b-0 last:pb-0">
                    <span>{grant.employee}（{grant.employeeId}）</span>
                    <span className="text-muted-foreground">
                      {t("dashboard:compExpiringSoon.remaining", { hours: (grant.hours - grant.usedHours).toFixed(1) })}
                      {" · "}
                      {t("dashboard:compExpiringSoon.deadline", { date: grant.deadline })}
                    </span>
                  </li>
                ))}
              </ul>
              {expiringSoon.length > 5 && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("dashboard:compExpiringSoon.more", { count: expiringSoon.length - 5 })}
                </p>
              )}
            </CardContent>
          </Card>
        </Link>
      )}
    </div>
  );
};

export default Dashboard;
