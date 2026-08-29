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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Download, Calendar, Upload } from "lucide-react";
import { dashboardApi } from "@/services/dashboardApi";
import { useAttendance } from "@/hooks/useAttendance";

const Reports = () => {
  const { t } = useTranslation(["reports", "common"]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const currentDate = new Date();
  const [attendanceYear, setAttendanceYear] = useState(currentDate.getFullYear());
  const [attendanceMonth, setAttendanceMonth] = useState(currentDate.getMonth() + 1);
  const [importYear, setImportYear] = useState(currentDate.getFullYear());
  const [importFile, setImportFile] = useState<File | null>(null);
  const { summary, loading: loadingAttendance, isImporting, importFile: doImport } = useAttendance(attendanceYear, attendanceMonth);

  const handleImport = async () => {
    if (!importFile) return;
    const result = await doImport(importFile, importYear);
    if (result) {
      setImportFile(null);
    }
  };
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
        <TabsContent value="attendance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("reports:attendance.importTitle")}</CardTitle>
              <CardDescription>{t("reports:attendance.importDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-2">
                  <Label htmlFor="attendanceImportYear">{t("reports:attendance.yearLabel")}</Label>
                  <Input
                    id="attendanceImportYear"
                    type="number"
                    className="w-28"
                    value={importYear}
                    onChange={(e) => setImportYear(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="attendanceImportFile">{t("reports:attendance.fileLabel")}</Label>
                  <Input
                    id="attendanceImportFile"
                    type="file"
                    accept=".xls,.xlsx"
                    className="w-64"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  />
                </div>
                <Button onClick={handleImport} disabled={!importFile || isImporting}>
                  <Upload className="mr-2 h-4 w-4" />
                  {isImporting ? t("reports:attendance.importing") : t("reports:attendance.importButton")}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{t("reports:attendance.summaryTitle")}</CardTitle>
                  <CardDescription>{t("reports:attendance.summaryDescription")}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={String(attendanceYear)} onValueChange={(value) => setAttendanceYear(Number(value))}>
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[currentDate.getFullYear() - 1, currentDate.getFullYear(), currentDate.getFullYear() + 1].map((y) => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={String(attendanceMonth)} onValueChange={(value) => setAttendanceMonth(Number(value))}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <SelectItem key={m} value={String(m)}>{t("reports:attendance.monthLabel")} {m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("reports:attendance.columns.employeeId")}</TableHead>
                      <TableHead>{t("reports:attendance.columns.name")}</TableHead>
                      <TableHead>{t("reports:attendance.columns.department")}</TableHead>
                      <TableHead>{t("reports:attendance.columns.normalDays")}</TableHead>
                      <TableHead>{t("reports:attendance.columns.missingDays")}</TableHead>
                      <TableHead>{t("reports:attendance.columns.lateCount")}</TableHead>
                      <TableHead>{t("reports:attendance.columns.earlyLeaveCount")}</TableHead>
                      <TableHead>{t("reports:attendance.columns.leaveDays")}</TableHead>
                      <TableHead>{t("reports:attendance.columns.dayOffDays")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.map((row) => (
                      <TableRow key={row.employeeId}>
                        <TableCell>{row.employeeId}</TableCell>
                        <TableCell>{row.employeeName}</TableCell>
                        <TableCell>{row.department}</TableCell>
                        <TableCell>{row.normalDays}</TableCell>
                        <TableCell className={row.missingDays > 0 ? "text-red-600" : undefined}>{row.missingDays}</TableCell>
                        <TableCell className={row.lateCount > 0 ? "text-orange-600" : undefined}>{row.lateCount}</TableCell>
                        <TableCell className={row.earlyLeaveCount > 0 ? "text-orange-600" : undefined}>{row.earlyLeaveCount}</TableCell>
                        <TableCell>{row.leaveDays}</TableCell>
                        <TableCell>{row.dayOffDays}</TableCell>
                      </TableRow>
                    ))}
                    {!loadingAttendance && summary.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                          {t("reports:attendance.noData")}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
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
