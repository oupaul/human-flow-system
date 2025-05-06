
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

// Mock data
const leaveDistributionData = [
  { name: "特休", value: 35, color: "#3b82f6" },
  { name: "事假", value: 15, color: "#f59e0b" },
  { name: "病假", value: 10, color: "#ef4444" },
  { name: "婚假", value: 5, color: "#10b981" },
  { name: "公假", value: 5, color: "#8b5cf6" },
];

const departmentAttendanceData = [
  { name: "IT部門", attendance: 95 },
  { name: "行銷部門", attendance: 88 },
  { name: "人資部門", attendance: 92 },
  { name: "財務部門", attendance: 90 },
  { name: "業務部門", attendance: 85 },
];

const Dashboard = () => {
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
              <h3 className="text-2xl font-bold">152</h3>
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
              <h3 className="text-2xl font-bold">28</h3>
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
              <h3 className="text-2xl font-bold">92%</h3>
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
              <h3 className="text-2xl font-bold">7</h3>
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
                  data={departmentAttendanceData}
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
                    data={leaveDistributionData}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {leaveDistributionData.map((entry, index) => (
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
