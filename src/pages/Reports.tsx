import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Download, Calendar, RefreshCcw } from "lucide-react";
import { dashboardApi } from "@/services/dashboardApi";

// Mock attendance data by month
const attendanceByMonth = [
  { month: "1月", attendance: 95.2 },
  { month: "2月", attendance: 94.8 },
  { month: "3月", attendance: 93.5 },
  { month: "4月", attendance: 96.1 },
  { month: "5月", attendance: 95.8 },
  { month: "6月", attendance: 94.2 },
  { month: "7月", attendance: 93.0 },
  { month: "8月", attendance: 92.5 },
  { month: "9月", attendance: 94.7 },
  { month: "10月", attendance: 96.3 },
  { month: "11月", attendance: 95.5 },
  { month: "12月", attendance: 93.8 },
];

// Mock leave distribution data
const leaveDistributionData = [
  { name: "特休", value: 45, color: "#3b82f6" },
  { name: "事假", value: 20, color: "#f59e0b" },
  { name: "病假", value: 15, color: "#ef4444" },
  { name: "婚假", value: 5, color: "#10b981" },
  { name: "喪假", value: 3, color: "#8b5cf6" },
  { name: "公假", value: 7, color: "#06b6d4" },
  { name: "其他", value: 5, color: "#6b7280" },
];

const Reports = () => {
  const [selectedYear, setSelectedYear] = useState("2023");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [departmentComparison, setDepartmentComparison] = useState([]);
  const [loadingDepartment, setLoadingDepartment] = useState(false);
  const [leaveDistribution, setLeaveDistribution] = useState([]);
  const [loadingLeave, setLoadingLeave] = useState(false);

  useEffect(() => {
    const fetchDepartmentComparison = async () => {
      setLoadingDepartment(true);
      try {
        const data = await dashboardApi.getDepartmentAttendance();
        setDepartmentComparison(data);
      } catch (e) {
        setDepartmentComparison([]);
      } finally {
        setLoadingDepartment(false);
      }
    };
    fetchDepartmentComparison();
  }, []);

  useEffect(() => {
    const fetchLeaveDistribution = async () => {
      setLoadingLeave(true);
      try {
        const data = await dashboardApi.getLeaveDistribution();
        setLeaveDistribution(data);
      } catch (e) {
        setLeaveDistribution([]);
      } finally {
        setLoadingLeave(false);
      }
    };
    fetchLeaveDistribution();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">報表分析</h1>
        <div className="text-sm text-muted-foreground">
          資料更新時間: {new Date().toLocaleString('zh-TW')}
        </div>
      </div>

      <Tabs defaultValue="attendance">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="attendance">出勤分析</TabsTrigger>
          <TabsTrigger value="leave">請假分析</TabsTrigger>
          <TabsTrigger value="department">部門比較</TabsTrigger>
        </TabsList>
        
        {/* 出勤分析 Tab */}
        <TabsContent value="attendance">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>年度出勤率趨勢</CardTitle>
                  <CardDescription>各月份公司整體出勤率變化</CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <Select 
                    value={selectedYear} 
                    onValueChange={setSelectedYear}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="選擇年份" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2021">2021年</SelectItem>
                      <SelectItem value="2022">2022年</SelectItem>
                      <SelectItem value="2023">2023年</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon">
                    <RefreshCcw className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-96 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={attendanceByMonth}
                    margin={{
                      top: 20,
                      right: 30,
                      left: 20,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis 
                      domain={[90, 100]}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <Tooltip formatter={(value) => [`${value}%`, "出勤率"]} />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="attendance" 
                      name="出勤率" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      dot={{ stroke: '#3b82f6', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 8 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* 請假分析 Tab */}
        <TabsContent value="leave">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>請假類型分布</CardTitle>
                  <CardDescription>各類請假使用比例統計</CardDescription>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="date-from" className="text-sm font-medium">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                    </Label>
                    <Input
                      id="date-from"
                      type="date"
                      className="w-36"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="date-to" className="text-sm font-medium">
                      到
                    </Label>
                    <Input
                      id="date-to"
                      type="date"
                      className="w-36"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                  <Button variant="outline" size="icon">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6 mt-4">
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
                
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={leaveDistribution}
                      layout="vertical"
                      margin={{
                        top: 5,
                        right: 30,
                        left: 50,
                        bottom: 5,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" />
                      <Tooltip />
                      <Bar 
                        dataKey="value" 
                        name="請假天數" 
                        fill="#3b82f6" 
                        radius={[0, 4, 4, 0]}
                      >
                        {leaveDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              {!loadingLeave && leaveDistribution.length === 0 && (
                <div className="text-center text-muted-foreground mt-4">無請假分布資料</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* 部門比較 Tab */}
        <TabsContent value="department">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>部門數據比較</CardTitle>
                  <CardDescription>各部門出勤、請假與加班情況比較</CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <Select defaultValue="currentMonth">
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="選擇時間範圍" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="currentMonth">本月</SelectItem>
                      <SelectItem value="lastMonth">上個月</SelectItem>
                      <SelectItem value="currentQuarter">本季</SelectItem>
                      <SelectItem value="lastQuarter">上季</SelectItem>
                      <SelectItem value="currentYear">今年</SelectItem>
                      <SelectItem value="lastYear">去年</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-96 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={departmentComparison}
                    margin={{
                      top: 20,
                      right: 30,
                      left: 20,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis yAxisId="left" orientation="left" label={{ value: '百分比 (%)', angle: -90, position: 'insideLeft' }} />
                    <YAxis yAxisId="right" orientation="right" label={{ value: '小時', angle: 90, position: 'insideRight' }} />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="attendance" name="出勤率 (%)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="left" dataKey="leave" name="請假率 (%)" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="right" dataKey="overtime" name="平均加班時數" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {!loadingDepartment && departmentComparison.length === 0 && (
                <div className="text-center text-muted-foreground mt-4">無部門比較資料</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reports;
