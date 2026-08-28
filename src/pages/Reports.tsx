import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
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
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Download, Calendar } from "lucide-react";
import { dashboardApi } from "@/services/dashboardApi";

const Reports = () => {
  const { t } = useTranslation(["reports", "common"]);
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
        <h1 className="text-2xl font-bold tracking-tight">{t("common:nav.reports")}</h1>
        <div className="text-sm text-muted-foreground">
          {t("reports:updatedAt", { time: new Date().toLocaleString('zh-TW') })}
        </div>
      </div>

      <Tabs defaultValue="attendance">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="attendance">{t("reports:tabs.attendance")}</TabsTrigger>
          <TabsTrigger value="leave">{t("reports:tabs.leave")}</TabsTrigger>
          <TabsTrigger value="department">{t("reports:tabs.department")}</TabsTrigger>
        </TabsList>

        {/* 出勤分析 Tab */}
        <TabsContent value="attendance">
          <Card>
            <CardHeader>
              <CardTitle>{t("reports:attendance.title")}</CardTitle>
              <CardDescription>{t("reports:attendance.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center text-muted-foreground py-12">
                {t("reports:attendance.featureUnavailable")}
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
                  <CardTitle>{t("reports:leave.title")}</CardTitle>
                  <CardDescription>{t("reports:leave.description")}</CardDescription>
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
                      {t("reports:leave.dateTo")}
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
                        name={t("reports:leave.seriesName")}
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
                <div className="text-center text-muted-foreground mt-4">{t("reports:leave.noData")}</div>
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
                  <CardTitle>{t("reports:department.title")}</CardTitle>
                  <CardDescription>{t("reports:department.description")}</CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <Select defaultValue="currentMonth">
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder={t("reports:department.rangePlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="currentMonth">{t("reports:department.range.currentMonth")}</SelectItem>
                      <SelectItem value="lastMonth">{t("reports:department.range.lastMonth")}</SelectItem>
                      <SelectItem value="currentQuarter">{t("reports:department.range.currentQuarter")}</SelectItem>
                      <SelectItem value="lastQuarter">{t("reports:department.range.lastQuarter")}</SelectItem>
                      <SelectItem value="currentYear">{t("reports:department.range.currentYear")}</SelectItem>
                      <SelectItem value="lastYear">{t("reports:department.range.lastYear")}</SelectItem>
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
                    <YAxis yAxisId="left" orientation="left" label={{ value: t("reports:department.axis.percentage"), angle: -90, position: 'insideLeft' }} />
                    <YAxis yAxisId="right" orientation="right" label={{ value: t("reports:department.axis.hours"), angle: 90, position: 'insideRight' }} />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="attendance" name={t("reports:department.series.attendance")} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="left" dataKey="leave" name={t("reports:department.series.leave")} fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="right" dataKey="overtime" name={t("reports:department.series.overtime")} fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {!loadingDepartment && departmentComparison.length === 0 && (
                <div className="text-center text-muted-foreground mt-4">{t("reports:department.noData")}</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reports;
