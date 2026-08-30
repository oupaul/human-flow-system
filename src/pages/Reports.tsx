import { useState, useEffect, useCallback } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { dashboardApi, LeaveDistributionDetailRow } from "@/services/dashboardApi";
import { useAttendance } from "@/hooks/useAttendance";
import { useLeaveImport } from "@/hooks/useLeaveImport";

type DepartmentRange = "currentMonth" | "lastMonth" | "currentQuarter" | "lastQuarter" | "currentYear" | "lastYear";

const toDateStr = (d: Date) => d.toISOString().slice(0, 10);

const getRangeDates = (range: DepartmentRange, now: Date): { startDate: string; endDate: string } => {
  const year = now.getFullYear();
  const month = now.getMonth();
  switch (range) {
    case "lastMonth":
      return { startDate: toDateStr(new Date(year, month - 1, 1)), endDate: toDateStr(new Date(year, month, 0)) };
    case "currentQuarter": {
      const qStartMonth = Math.floor(month / 3) * 3;
      return { startDate: toDateStr(new Date(year, qStartMonth, 1)), endDate: toDateStr(new Date(year, qStartMonth + 3, 0)) };
    }
    case "lastQuarter": {
      const qStartMonth = Math.floor(month / 3) * 3 - 3;
      return { startDate: toDateStr(new Date(year, qStartMonth, 1)), endDate: toDateStr(new Date(year, qStartMonth + 3, 0)) };
    }
    case "currentYear":
      return { startDate: toDateStr(new Date(year, 0, 1)), endDate: toDateStr(new Date(year, 11, 31)) };
    case "lastYear":
      return { startDate: toDateStr(new Date(year - 1, 0, 1)), endDate: toDateStr(new Date(year - 1, 11, 31)) };
    case "currentMonth":
    default:
      return { startDate: toDateStr(new Date(year, month, 1)), endDate: toDateStr(new Date(year, month + 1, 0)) };
  }
};

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
  const [departmentRange, setDepartmentRange] = useState<DepartmentRange>("currentMonth");
  const [leaveDistribution, setLeaveDistribution] = useState([]);
  const [loadingLeave, setLoadingLeave] = useState(false);

  useEffect(() => {
    const fetchDepartmentComparison = async () => {
      setLoadingDepartment(true);
      try {
        const { startDate, endDate } = getRangeDates(departmentRange, new Date());
        const data = await dashboardApi.getDepartmentAttendance(startDate, endDate);
        setDepartmentComparison(data);
      } catch (e) {
        setDepartmentComparison([]);
      } finally {
        setLoadingDepartment(false);
      }
    };
    fetchDepartmentComparison();
  }, [departmentRange]);

  const handleExportDepartmentComparison = () => {
    const header = `${t("reports:department.title")},${t("reports:department.series.attendance")},${t("reports:department.series.leave")},${t("reports:department.series.overtime")}`;
    const rows = departmentComparison.map(
      (row: { name: string; attendance: number; leave: number; overtime: number }) =>
        `${row.name},${row.attendance},${row.leave},${row.overtime}`
    );
    const csvContent = "﻿" + [header, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `department-comparison-${departmentRange}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const fetchLeaveDistribution = useCallback(async () => {
    setLoadingLeave(true);
    try {
      const data = await dashboardApi.getLeaveDistribution(startDate || undefined, endDate || undefined);
      setLeaveDistribution(data);
    } catch (e) {
      setLeaveDistribution([]);
    } finally {
      setLoadingLeave(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchLeaveDistribution();
  }, [fetchLeaveDistribution]);

  const { isImporting: isImportingLeave, importFile: doImportLeave } = useLeaveImport(fetchLeaveDistribution);
  const [importLeaveFile, setImportLeaveFile] = useState<File | null>(null);

  const handleImportLeave = async () => {
    if (!importLeaveFile) return;
    const result = await doImportLeave(importLeaveFile);
    if (result) {
      setImportLeaveFile(null);
    }
  };

  const handleExportLeaveDistribution = () => {
    const header = `${t("reports:leave.title")},${t("reports:leave.seriesName")}`;
    const rows = leaveDistribution.map((row) => `${row.name},${row.value}`);
    const csvContent = "﻿" + [header, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `leave-distribution-${startDate || "current"}_to_${endDate || "current"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const [selectedLeaveType, setSelectedLeaveType] = useState<string | null>(null);
  const [leaveTypeDetail, setLeaveTypeDetail] = useState<LeaveDistributionDetailRow[]>([]);
  const [loadingLeaveTypeDetail, setLoadingLeaveTypeDetail] = useState(false);

  const handleLeaveTypeClick = async (name: string) => {
    setSelectedLeaveType(name);
    setLoadingLeaveTypeDetail(true);
    try {
      const data = await dashboardApi.getLeaveDistributionDetail(name, startDate || undefined, endDate || undefined);
      setLeaveTypeDetail(data);
    } catch (e) {
      setLeaveTypeDetail([]);
    } finally {
      setLoadingLeaveTypeDetail(false);
    }
  };

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
        <TabsContent value="leave" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("reports:leave.importTitle")}</CardTitle>
              <CardDescription>{t("reports:leave.importDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-2">
                  <Label htmlFor="leaveImportFile">{t("reports:leave.fileLabel")}</Label>
                  <Input
                    id="leaveImportFile"
                    type="file"
                    accept=".xls,.xlsx"
                    className="w-64"
                    onChange={(e) => setImportLeaveFile(e.target.files?.[0] || null)}
                  />
                </div>
                <Button onClick={handleImportLeave} disabled={!importLeaveFile || isImportingLeave}>
                  <Upload className="mr-2 h-4 w-4" />
                  {isImportingLeave ? t("reports:leave.importing") : t("reports:leave.importButton")}
                </Button>
              </div>
            </CardContent>
          </Card>

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
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleExportLeaveDistribution}
                    disabled={leaveDistribution.length === 0}
                  >
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
                        cursor="pointer"
                        onClick={(entry) => handleLeaveTypeClick(entry.name)}
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
                        cursor="pointer"
                        onClick={(entry) => handleLeaveTypeClick(entry.name)}
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
              {!loadingLeave && leaveDistribution.length > 0 && (
                <div className="text-center text-sm text-muted-foreground mt-2">{t("reports:leave.detailHint")}</div>
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
                  <Select value={departmentRange} onValueChange={(value) => setDepartmentRange(value as DepartmentRange)}>
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
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleExportDepartmentComparison}
                    disabled={departmentComparison.length === 0}
                  >
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

      <Dialog open={selectedLeaveType !== null} onOpenChange={(open) => !open && setSelectedLeaveType(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("reports:leave.detailTitle", { name: selectedLeaveType })}</DialogTitle>
            <DialogDescription>{t("reports:leave.detailDescription")}</DialogDescription>
          </DialogHeader>
          <div className="rounded-md border max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("reports:leave.detailColumns.employee")}</TableHead>
                  <TableHead>{t("reports:leave.detailColumns.department")}</TableHead>
                  <TableHead>{t("reports:leave.detailColumns.period")}</TableHead>
                  <TableHead>{t("reports:leave.detailColumns.value")}</TableHead>
                  <TableHead>{t("reports:leave.detailColumns.source")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaveTypeDetail.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{row.employeeName}（{row.employeeId}）</TableCell>
                    <TableCell>{row.department}</TableCell>
                    <TableCell>{row.eventDate === row.endDate ? row.eventDate : `${row.eventDate} ~ ${row.endDate}`}</TableCell>
                    <TableCell>{row.value}</TableCell>
                    <TableCell>{row.source === "imported" ? t("reports:leave.detailColumns.sourceImported") : t("reports:leave.detailColumns.sourceApplication")}</TableCell>
                  </TableRow>
                ))}
                {!loadingLeaveTypeDetail && leaveTypeDetail.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      {t("reports:leave.detailNoData")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Reports;
