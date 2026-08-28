
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, FileText, CheckCircle2, XCircle, Loader2, RefreshCcw, Upload, Trash2, Clock, Paperclip } from "lucide-react";
import { Calendar as HolidayCalendar } from "@/components/ui/calendar";
import { zhTW, ja as jaLocale, enUS } from "date-fns/locale";
import { useLeaveManagement } from "@/hooks/useLeaveManagement";
import { useOvertimeApplications } from "@/hooks/useOvertimeApplications";
import { useHolidays } from "@/hooks/useHolidays";
import { useLeavePeriodSettlements } from "@/hooks/useLeavePeriodSettlements";
import { useLeaveGrants } from "@/hooks/useLeaveGrants";
import { useCompTimeGrants } from "@/hooks/useCompTimeGrants";
import { useCompTimeSettlements } from "@/hooks/useCompTimeSettlements";
import { useAuth } from "@/contexts/AuthContext";
import { LeaveApplicationFormData, LeaveApplication, LeaveBalance } from "@/types/leave";
import { OvertimeApplication, OvertimeApplicationFormData } from "@/types/overtime";
import { PendingLeavePeriodSettlement } from "@/types/leavePeriod";
import { LeaveGrantFormData } from "@/types/leaveGrant";
import { leaveApi } from "@/services/leaveApi";
import { employeeApi } from "@/services/employeeApi";
import { Employee } from "@/types/employee";

const LeaveManagement = () => {
  const { t, i18n } = useTranslation(["leaveManagement", "common"]);
  const calendarLocale = { "zh-TW": zhTW, en: enUS, ja: jaLocale }[i18n.resolvedLanguage || "zh-TW"] || zhTW;
  const { user } = useAuth();
  const approverName = user?.employeeName || user?.username || t("leaveManagement:defaultApproverName");

  const {
    leaveTypes,
    leaveApplications,
    leaveBalances,
    loading,
    createLeaveApplication,
    updateApplicationStatus,
    recalculateAnnualLeave,
    adjustLeaveBalance,
  } = useLeaveManagement();

  const {
    overtimeApplications,
    createOvertimeApplication,
    updateOvertimeStatus,
  } = useOvertimeApplications();

  const { pendingSettlements, settlePeriod } = useLeavePeriodSettlements();
  const [settlingPeriod, setSettlingPeriod] = useState<PendingLeavePeriodSettlement | null>(null);
  const [carryOverDays, setCarryOverDays] = useState(0);

  const { leaveGrants, createLeaveGrant, deleteLeaveGrant } = useLeaveGrants();
  const [grantForm, setGrantForm] = useState<Partial<LeaveGrantFormData>>({});
  const [selectedGrantLeaveType, setSelectedGrantLeaveType] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);

  const { compTimeGrants } = useCompTimeGrants();
  const { pendingSettlements: pendingCompSettlements, settleGrant: settleCompGrant } = useCompTimeSettlements();
  const [viewingCompLedgerFor, setViewingCompLedgerFor] = useState<LeaveBalance | null>(null);

  const VALID_TABS = ["applications", "overtime", "balance", "settlement", "grants", "types", "holidays"];
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab = VALID_TABS.includes(tabParam || "") ? tabParam! : "applications";
  const handleTabChange = (value: string) => {
    setSearchParams(value === "applications" ? {} : { tab: value });
  };

  const pendingLeaveCount = useMemo(
    () => leaveApplications.filter((application) => application.status === "pending").length,
    [leaveApplications]
  );
  const pendingOvertimeCount = useMemo(
    () => overtimeApplications.filter((application) => application.status === "pending").length,
    [overtimeApplications]
  );

  useEffect(() => {
    employeeApi.getEmployees().then(setEmployees).catch(() => setEmployees([]));
  }, []);

  const currentYear = new Date().getFullYear();
  const [holidayYear, setHolidayYear] = useState(currentYear);
  const { holidays, importHolidays, deleteHoliday } = useHolidays(holidayYear);
  const [holidayCsv, setHolidayCsv] = useState("");
  const [holidayCalendarMonth, setHolidayCalendarMonth] = useState(new Date(holidayYear, 0, 1));

  useEffect(() => {
    setHolidayCalendarMonth(new Date(holidayYear, 0, 1));
  }, [holidayYear]);

  // 用本地時區的年月日組字串比對，避免 new Date(dateString) 依 UTC 解析造成的日期偏移
  const toDateKey = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  const parseDateKey = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const isWeekendDate = (dateStr: string) => {
    const day = parseDateKey(dateStr).getDay();
    return day === 0 || day === 6;
  };

  // 人事行政總處的日曆表是「每一天」都有一筆紀錄（是否放假 0/2），不是只有
  // 特殊日期，所以平日的「上班」紀錄也會被匯入，isHoliday 為 false。這裡分
  // 三類：假日（isHoliday）、補班日（isHoliday=false 但原本是週末）、一般
  // 上班日（isHoliday=false 且原本就是平日），三種都會標示，方便確認匯入
  // 是否完整涵蓋每一天
  const holidayByDateKey = useMemo(() => {
    const map = new Map<string, typeof holidays[number]>();
    holidays.forEach((holiday) => map.set(holiday.date, holiday));
    return map;
  }, [holidays]);

  const holidayDates = useMemo(
    () => holidays.filter((h) => h.isHoliday).map((h) => parseDateKey(h.date)),
    [holidays]
  );
  const makeupWorkdayDates = useMemo(
    () => holidays.filter((h) => !h.isHoliday && isWeekendDate(h.date)).map((h) => parseDateKey(h.date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [holidays]
  );
  const regularWorkdayDates = useMemo(
    () => holidays.filter((h) => !h.isHoliday && !isWeekendDate(h.date)).map((h) => parseDateKey(h.date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [holidays]
  );

  const [isAddLeaveOpen, setIsAddLeaveOpen] = useState(false);
  const [selectedLeaveType, setSelectedLeaveType] = useState("");
  const [formData, setFormData] = useState<Partial<LeaveApplicationFormData>>({
    unit: 'day'
  });
  const [leaveAttachment, setLeaveAttachment] = useState<File | null>(null);
  const selectedLeaveTypeInfo = leaveTypes.find((lt) => lt.id.toString() === selectedLeaveType);
  const selectedLeaveTypeNeedsProof = selectedLeaveTypeInfo?.needProof;
  const selectedLeaveTypeIsComp = selectedLeaveTypeInfo?.code === 'COMP';

  // 生理假僅限女性員工可選：依目前輸入的員工編號比對性別，未填寫員工編號或
  // 性別時不過濾（避免資料不完整時誤擋，實際核准前後端仍會再檢查一次）
  const enteredEmployeeForLeave = employees.find((e) => e.employeeId === formData.employeeId);
  const availableLeaveTypesForApplication = leaveTypes.filter(
    (lt) => lt.code !== 'MSL' || enteredEmployeeForLeave?.gender !== 'male'
  );

  const [isAddOvertimeOpen, setIsAddOvertimeOpen] = useState(false);
  const [overtimeFormData, setOvertimeFormData] = useState<Partial<OvertimeApplicationFormData>>({ compensationType: 'pay' });

  const [reviewingApplication, setReviewingApplication] = useState<LeaveApplication | null>(null);
  const [reviewAction, setReviewAction] = useState<'approved' | 'rejected'>('approved');
  const [approvedDays, setApprovedDays] = useState(0);
  const [reviewNote, setReviewNote] = useState("");

  const [reviewingOvertime, setReviewingOvertime] = useState<OvertimeApplication | null>(null);
  const [overtimeReviewAction, setOvertimeReviewAction] = useState<'approved' | 'rejected'>('approved');
  const [overtimeReviewNote, setOvertimeReviewNote] = useState("");

  const [adjustingBalance, setAdjustingBalance] = useState<LeaveBalance | null>(null);
  const [adjustForm, setAdjustForm] = useState({
    annualLeaveUsed: 0,
    sickLeave: 0,
    sickLeaveUsed: 0,
  });

  const handleSubmitApplication = async () => {
    if (!formData.employeeId || !formData.leaveTypeId || !formData.startDate || !formData.reason) {
      return;
    }
    if (selectedLeaveTypeIsComp) {
      if (!formData.startTime || !formData.endTime) return;
    } else if (!formData.endDate) {
      return;
    }

    const payload: LeaveApplicationFormData = selectedLeaveTypeIsComp
      ? { ...(formData as LeaveApplicationFormData), endDate: formData.startDate }
      : (formData as LeaveApplicationFormData);

    await createLeaveApplication(payload, leaveAttachment || undefined);
    setIsAddLeaveOpen(false);
    setFormData({ unit: 'day' });
    setSelectedLeaveType("");
    setLeaveAttachment(null);
  };

  const openReviewDialog = (application: LeaveApplication, action: 'approved' | 'rejected') => {
    setReviewingApplication(application);
    setReviewAction(action);
    setApprovedDays(application.days);
    setReviewNote("");
  };

  const handleConfirmReview = async () => {
    if (!reviewingApplication) return;
    await updateApplicationStatus(
      reviewingApplication.id,
      reviewAction,
      approverName,
      reviewAction === 'approved' ? approvedDays : undefined,
      reviewNote || undefined
    );
    setReviewingApplication(null);
  };

  const handleSubmitOvertime = async () => {
    if (!overtimeFormData.employeeId || !overtimeFormData.date || !overtimeFormData.startTime || !overtimeFormData.endTime || !overtimeFormData.reason) {
      return;
    }

    await createOvertimeApplication(overtimeFormData as OvertimeApplicationFormData);
    setIsAddOvertimeOpen(false);
    setOvertimeFormData({ compensationType: 'pay' });
  };

  const openOvertimeReviewDialog = (application: OvertimeApplication, action: 'approved' | 'rejected') => {
    setReviewingOvertime(application);
    setOvertimeReviewAction(action);
    setOvertimeReviewNote("");
  };

  const handleConfirmOvertimeReview = async () => {
    if (!reviewingOvertime) return;
    await updateOvertimeStatus(reviewingOvertime.id, overtimeReviewAction, approverName, overtimeReviewNote || undefined);
    setReviewingOvertime(null);
  };

  const handleViewAttachment = async (applicationId: number) => {
    try {
      const blob = await leaveApi.downloadLeaveAttachment(applicationId);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (error) {
      console.error("Failed to view attachment:", error);
    }
  };

  const handleImportHolidays = async () => {
    if (!holidayCsv.trim()) return;
    await importHolidays(holidayCsv);
    setHolidayCsv("");
  };

  const handleCreateGrant = async () => {
    if (!grantForm.employeeId || !grantForm.leaveTypeId || !grantForm.totalDays) return;
    await createLeaveGrant(grantForm as LeaveGrantFormData);
    setGrantForm({});
    setSelectedGrantLeaveType("");
  };

  const openAdjustDialog = (balance: LeaveBalance) => {
    setAdjustingBalance(balance);
    setAdjustForm({
      annualLeaveUsed: balance.annualLeaveUsed,
      sickLeave: balance.sickLeave,
      sickLeaveUsed: balance.sickLeaveUsed,
    });
  };

  const handleConfirmAdjust = async () => {
    if (!adjustingBalance) return;
    await adjustLeaveBalance(adjustingBalance, adjustForm);
    setAdjustingBalance(null);
  };

  const openSettleDialog = (period: PendingLeavePeriodSettlement) => {
    setSettlingPeriod(period);
    setCarryOverDays(0);
  };

  const handleConfirmSettle = async () => {
    if (!settlingPeriod) return;
    await settlePeriod(settlingPeriod.id, carryOverDays);
    setSettlingPeriod(null);
  };

  const handleSettleComp = async (id: number) => {
    await settleCompGrant(id);
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <>
            <CheckCircle2 className="mr-1 h-4 w-4 text-green-500" />
            <span className="text-green-500">{t("common:status.approved")}</span>
          </>
        );
      case 'rejected':
        return (
          <>
            <XCircle className="mr-1 h-4 w-4 text-red-500" />
            <span className="text-red-500">{t("common:status.rejected")}</span>
          </>
        );
      default:
        return <span className="text-yellow-500">{t("common:status.pending")}</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">{t("common:common.loading")}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("common:nav.leaveManagement")}</h1>
        <div className="flex gap-2">
        <Dialog open={isAddOvertimeOpen} onOpenChange={setIsAddOvertimeOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Clock className="mr-2 h-4 w-4" /> {t("leaveManagement:applyOvertimeButton")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{t("leaveManagement:overtime.applyDialog.title")}</DialogTitle>
              <DialogDescription>
                {t("leaveManagement:overtime.applyDialog.description")}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="overtimeEmployeeId">{t("leaveManagement:overtime.applyDialog.employeeId")}</Label>
                <Input
                  id="overtimeEmployeeId"
                  value={overtimeFormData.employeeId || ''}
                  onChange={(e) => setOvertimeFormData({ ...overtimeFormData, employeeId: e.target.value })}
                  placeholder={t("leaveManagement:overtime.applyDialog.employeeIdPlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="overtimeDate">{t("leaveManagement:overtime.applyDialog.date")}</Label>
                <Input
                  id="overtimeDate"
                  type="date"
                  value={overtimeFormData.date || ''}
                  onChange={(e) => setOvertimeFormData({ ...overtimeFormData, date: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="overtimeStart">{t("leaveManagement:overtime.applyDialog.startTime")}</Label>
                  <Input
                    id="overtimeStart"
                    type="time"
                    value={overtimeFormData.startTime || ''}
                    onChange={(e) => setOvertimeFormData({ ...overtimeFormData, startTime: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="overtimeEnd">{t("leaveManagement:overtime.applyDialog.endTime")}</Label>
                  <Input
                    id="overtimeEnd"
                    type="time"
                    value={overtimeFormData.endTime || ''}
                    onChange={(e) => setOvertimeFormData({ ...overtimeFormData, endTime: e.target.value })}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{t("leaveManagement:overtime.applyDialog.lunchBreakHint")}</p>
              <div className="space-y-2">
                <Label htmlFor="overtimeReason">{t("leaveManagement:overtime.applyDialog.reason")}</Label>
                <Textarea
                  id="overtimeReason"
                  placeholder={t("leaveManagement:overtime.applyDialog.reasonPlaceholder")}
                  rows={3}
                  value={overtimeFormData.reason || ''}
                  onChange={(e) => setOvertimeFormData({ ...overtimeFormData, reason: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="overtimeCompensationType">{t("leaveManagement:overtime.applyDialog.compensationType")}</Label>
                <Select
                  value={overtimeFormData.compensationType || 'pay'}
                  onValueChange={(value: 'pay' | 'comp') => setOvertimeFormData({ ...overtimeFormData, compensationType: value })}
                >
                  <SelectTrigger id="overtimeCompensationType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pay">{t("leaveManagement:overtime.applyDialog.compensationTypePay")}</SelectItem>
                    <SelectItem value="comp">{t("leaveManagement:overtime.applyDialog.compensationTypeComp")}</SelectItem>
                  </SelectContent>
                </Select>
                {overtimeFormData.compensationType === 'comp' && (
                  <p className="text-xs text-muted-foreground">
                    {t("leaveManagement:overtime.applyDialog.compHint")}
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddOvertimeOpen(false)}>
                {t("common:actions.cancel")}
              </Button>
              <Button onClick={handleSubmitOvertime}>
                {t("common:actions.submit")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={isAddLeaveOpen} onOpenChange={setIsAddLeaveOpen}>
          <DialogTrigger asChild>
            <Button className="bg-hrms-accent">
              <Plus className="mr-2 h-4 w-4" /> {t("leaveManagement:applyLeaveButton")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[550px]">
            <DialogHeader>
              <DialogTitle>{t("leaveManagement:applications.applyDialog.title")}</DialogTitle>
              <DialogDescription>
                {t("leaveManagement:applications.applyDialog.description")}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="employeeId">{t("leaveManagement:applications.applyDialog.employeeId")}</Label>
                  <Input
                    id="employeeId"
                    value={formData.employeeId || ''}
                    onChange={(e) => setFormData({...formData, employeeId: e.target.value})}
                    placeholder={t("leaveManagement:applications.applyDialog.employeeIdPlaceholder")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="leaveType">{t("leaveManagement:applications.applyDialog.leaveType")}</Label>
                  <Select
                    value={selectedLeaveType}
                    onValueChange={(value) => {
                      setSelectedLeaveType(value);
                      setFormData({...formData, leaveTypeId: parseInt(value)});
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("leaveManagement:applications.applyDialog.leaveTypePlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableLeaveTypesForApplication.map((type) => (
                        <SelectItem key={type.id} value={type.id.toString()}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {selectedLeaveTypeIsComp ? (
                <>
                  {(() => {
                    const enteredBalance = leaveBalances.find((b) => b.employeeId === formData.employeeId);
                    if (!enteredBalance) return null;
                    return (
                      <p className="text-sm text-muted-foreground">
                        {t("leaveManagement:applications.applyDialog.compBalance", { hours: (enteredBalance.compensatoryLeave - enteredBalance.compensatoryLeaveUsed).toFixed(1) })}
                        {enteredBalance.compensatoryLeaveDeadline && t("leaveManagement:applications.applyDialog.compBalanceDeadline", { date: enteredBalance.compensatoryLeaveDeadline })}
                      </p>
                    );
                  })()}
                  <div className="space-y-2">
                    <Label htmlFor="compDate">{t("leaveManagement:applications.applyDialog.compDate")}</Label>
                    <Input
                      id="compDate"
                      type="date"
                      value={formData.startDate || ''}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value, endDate: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="compStartTime">{t("leaveManagement:applications.applyDialog.startTime")}</Label>
                      <Input
                        id="compStartTime"
                        type="time"
                        value={formData.startTime || ''}
                        onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="compEndTime">{t("leaveManagement:applications.applyDialog.endTime")}</Label>
                      <Input
                        id="compEndTime"
                        type="time"
                        value={formData.endTime || ''}
                        onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{t("leaveManagement:applications.applyDialog.lunchBreakHint")}</p>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="unit">{t("leaveManagement:applications.applyDialog.unit")}</Label>
                    <Select
                      value={formData.unit}
                      onValueChange={(value: 'day' | 'halfDay' | 'hour') => setFormData({...formData, unit: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("leaveManagement:applications.applyDialog.unitPlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="day">{t("leaveManagement:applications.applyDialog.unitDay")}</SelectItem>
                        <SelectItem value="halfDay">{t("leaveManagement:applications.applyDialog.unitHalfDay")}</SelectItem>
                        <SelectItem value="hour">{t("leaveManagement:applications.applyDialog.unitHour")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startDate">{t("leaveManagement:applications.applyDialog.startDate")}</Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={formData.startDate || ''}
                        onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endDate">{t("leaveManagement:applications.applyDialog.endDate")}</Label>
                      <Input
                        id="endDate"
                        type="date"
                        value={formData.endDate || ''}
                        onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                      />
                    </div>
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label htmlFor="reason">{t("leaveManagement:applications.applyDialog.reason")}</Label>
                <Textarea
                  id="reason"
                  placeholder={t("leaveManagement:applications.applyDialog.reasonPlaceholder")}
                  rows={3}
                  value={formData.reason || ''}
                  onChange={(e) => setFormData({...formData, reason: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deputy">{t("leaveManagement:applications.applyDialog.deputy")}</Label>
                <Input
                  id="deputy"
                  placeholder={t("leaveManagement:applications.applyDialog.deputyPlaceholder")}
                  value={formData.deputy || ''}
                  onChange={(e) => setFormData({...formData, deputy: e.target.value})}
                />
              </div>
              {selectedLeaveTypeNeedsProof && (
                <div className="space-y-2">
                  <Label htmlFor="leaveAttachment">{t("leaveManagement:applications.applyDialog.attachment")}</Label>
                  <Input
                    id="leaveAttachment"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(e) => setLeaveAttachment(e.target.files?.[0] || null)}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddLeaveOpen(false)}>
                {t("common:actions.cancel")}
              </Button>
              <Button onClick={handleSubmitApplication}>
                {t("common:actions.submit")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="applications">
            {t("leaveManagement:tabs.applications")}
            {pendingLeaveCount > 0 && (
              <span className="ml-1.5 rounded-full bg-hrms-warning px-1.5 py-0.5 text-xs font-semibold text-white">
                {pendingLeaveCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="overtime">
            {t("leaveManagement:tabs.overtime")}
            {pendingOvertimeCount > 0 && (
              <span className="ml-1.5 rounded-full bg-hrms-warning px-1.5 py-0.5 text-xs font-semibold text-white">
                {pendingOvertimeCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="balance">{t("leaveManagement:tabs.balance")}</TabsTrigger>
          <TabsTrigger value="settlement">{t("leaveManagement:tabs.settlement")}</TabsTrigger>
          <TabsTrigger value="grants">{t("leaveManagement:tabs.grants")}</TabsTrigger>
          <TabsTrigger value="types">{t("leaveManagement:tabs.types")}</TabsTrigger>
          <TabsTrigger value="holidays">{t("leaveManagement:tabs.holidays")}</TabsTrigger>
        </TabsList>

        <TabsContent value="applications">
          <Card>
            <CardHeader>
              <CardTitle>{t("leaveManagement:applications.listTitle")}</CardTitle>
              <CardDescription>
                {t("leaveManagement:applications.listDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("leaveManagement:applications.columns.employeeId")}</TableHead>
                      <TableHead>{t("leaveManagement:applications.columns.name")}</TableHead>
                      <TableHead>{t("leaveManagement:applications.columns.leaveType")}</TableHead>
                      <TableHead>{t("leaveManagement:applications.columns.startDate")}</TableHead>
                      <TableHead>{t("leaveManagement:applications.columns.endDate")}</TableHead>
                      <TableHead>{t("leaveManagement:applications.columns.days")}</TableHead>
                      <TableHead>{t("leaveManagement:applications.columns.status")}</TableHead>
                      <TableHead>{t("leaveManagement:applications.columns.attachment")}</TableHead>
                      <TableHead className="text-right">{t("leaveManagement:applications.columns.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaveApplications.map((application) => (
                      <TableRow key={application.id}>
                        <TableCell>{application.employeeId}</TableCell>
                        <TableCell>{application.employee}</TableCell>
                        <TableCell>{application.type}</TableCell>
                        <TableCell>{application.startDate}</TableCell>
                        <TableCell>{application.endDate}</TableCell>
                        <TableCell>{application.days}{application.type === '補休' ? t("leaveManagement:applications.hoursUnit") : t("leaveManagement:applications.daysUnit")}</TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            {getStatusDisplay(application.status)}
                          </div>
                          {application.reviewNote && (
                            <p className="mt-1 text-xs text-muted-foreground">{t("leaveManagement:applications.noteLine", { note: application.reviewNote })}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          {application.attachment ? (
                            <Button variant="ghost" size="icon" onClick={() => handleViewAttachment(application.id)} title={t("leaveManagement:applications.viewAttachment")}>
                              <Paperclip className="h-4 w-4" />
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-xs">{t("leaveManagement:applications.noAttachment")}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            {application.status === 'pending' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-green-600 hover:bg-green-50"
                                  onClick={() => openReviewDialog(application, 'approved')}
                                >
                                  {t("common:actions.approve")}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 hover:bg-red-50"
                                  onClick={() => openReviewDialog(application, 'rejected')}
                                >
                                  {t("common:actions.reject")}
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <Dialog open={!!reviewingApplication} onOpenChange={(open) => !open && setReviewingApplication(null)}>
          <DialogContent className="sm:max-w-[450px]">
            <DialogHeader>
              <DialogTitle>{reviewAction === 'approved' ? t("leaveManagement:applications.reviewDialog.titleApprove") : t("leaveManagement:applications.reviewDialog.titleReject")}</DialogTitle>
              <DialogDescription>
                {reviewingApplication && t("leaveManagement:applications.reviewDialog.descriptionLine", {
                  employee: reviewingApplication.employee,
                  employeeId: reviewingApplication.employeeId,
                  type: reviewingApplication.type,
                  startDate: reviewingApplication.startDate,
                  endDate: reviewingApplication.endDate,
                })}
              </DialogDescription>
            </DialogHeader>
            {reviewingApplication && (
              <div className="space-y-4 py-2">
                <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                  <p>{t("leaveManagement:applications.reviewDialog.reasonLine", { reason: reviewingApplication.reason })}</p>
                  {reviewingApplication.attachment && (
                    <Button variant="link" className="h-auto p-0" onClick={() => handleViewAttachment(reviewingApplication.id)}>
                      <Paperclip className="mr-1 h-3 w-3" /> {t("leaveManagement:applications.reviewDialog.viewAttachment")}
                    </Button>
                  )}
                </div>
                {reviewAction === 'approved' && reviewingApplication.grantId && (() => {
                  const grant = leaveGrants.find((g) => g.id === reviewingApplication.grantId);
                  return grant ? (
                    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
                      {t("leaveManagement:applications.reviewDialog.grantHintBefore")}<strong>{grant.totalDays - grant.usedDays}</strong>{t("leaveManagement:applications.reviewDialog.grantHintAfter", { total: grant.totalDays, deadline: grant.deadline || t("common:common.none") })}
                    </div>
                  ) : null;
                })()}
                {reviewAction === 'approved' && reviewingApplication.type === '補休' && (() => {
                  const balance = leaveBalances.find((b) => b.employeeId === reviewingApplication.employeeId);
                  if (!balance) return null;
                  return (
                    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
                      {t("leaveManagement:applications.reviewDialog.compHintBefore")}<strong>{(balance.compensatoryLeave - balance.compensatoryLeaveUsed).toFixed(1)}</strong>{t("leaveManagement:applications.reviewDialog.compHintAfter")}
                    </div>
                  );
                })()}
                {reviewAction === 'approved' && (
                  <div className="space-y-2">
                    <Label htmlFor="approvedDays">
                      {reviewingApplication.type === '補休' ? t("leaveManagement:applications.reviewDialog.approvedHoursLabel") : t("leaveManagement:applications.reviewDialog.approvedDaysLabel")}
                    </Label>
                    <Input
                      id="approvedDays"
                      type="number"
                      min={0}
                      step={0.5}
                      value={approvedDays}
                      onChange={(e) => setApprovedDays(Number(e.target.value))}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="reviewNote">{t("leaveManagement:applications.reviewDialog.reviewNoteLabel")}</Label>
                  <Textarea
                    id="reviewNote"
                    rows={3}
                    placeholder={reviewAction === 'approved' ? t("leaveManagement:applications.reviewDialog.reviewNotePlaceholderApprove") : t("leaveManagement:applications.reviewDialog.reviewNotePlaceholderReject")}
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setReviewingApplication(null)}>
                {t("common:actions.cancel")}
              </Button>
              <Button
                onClick={handleConfirmReview}
                className={reviewAction === 'rejected' ? 'bg-red-600 hover:bg-red-700' : undefined}
              >
                {reviewAction === 'approved' ? t("leaveManagement:applications.reviewDialog.confirmApprove") : t("leaveManagement:applications.reviewDialog.confirmReject")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <TabsContent value="overtime">
          <Card>
            <CardHeader>
              <CardTitle>{t("leaveManagement:overtime.listTitle")}</CardTitle>
              <CardDescription>
                {t("leaveManagement:overtime.listDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("leaveManagement:overtime.columns.employeeId")}</TableHead>
                      <TableHead>{t("leaveManagement:overtime.columns.name")}</TableHead>
                      <TableHead>{t("leaveManagement:overtime.columns.date")}</TableHead>
                      <TableHead>{t("leaveManagement:overtime.columns.period")}</TableHead>
                      <TableHead>{t("leaveManagement:overtime.columns.hours")}</TableHead>
                      <TableHead>{t("leaveManagement:overtime.columns.onHoliday")}</TableHead>
                      <TableHead>{t("leaveManagement:overtime.columns.compensationType")}</TableHead>
                      <TableHead>{t("leaveManagement:overtime.columns.status")}</TableHead>
                      <TableHead className="text-right">{t("leaveManagement:overtime.columns.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overtimeApplications.map((application) => (
                      <TableRow key={application.id}>
                        <TableCell>{application.employeeId}</TableCell>
                        <TableCell>{application.employee}</TableCell>
                        <TableCell>{application.date}</TableCell>
                        <TableCell>{application.startTime} - {application.endTime}</TableCell>
                        <TableCell>{application.hours}</TableCell>
                        <TableCell>
                          {application.onHoliday ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-gray-300" />
                          )}
                        </TableCell>
                        <TableCell>
                          {application.compensationType === 'comp'
                            ? (application.compHours
                                ? t("leaveManagement:overtime.compensationCompWithHours", { hours: application.compHours })
                                : t("leaveManagement:overtime.compensationComp"))
                            : t("leaveManagement:overtime.compensationPay")}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            {getStatusDisplay(application.status)}
                          </div>
                          {application.reviewNote && (
                            <p className="mt-1 text-xs text-muted-foreground">{t("leaveManagement:overtime.noteLine", { note: application.reviewNote })}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {application.status === 'pending' && (
                            <div className="flex gap-2 justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600 hover:bg-green-50"
                                onClick={() => openOvertimeReviewDialog(application, 'approved')}
                              >
                                {t("common:actions.approve")}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:bg-red-50"
                                onClick={() => openOvertimeReviewDialog(application, 'rejected')}
                              >
                                {t("common:actions.reject")}
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <Dialog open={!!reviewingOvertime} onOpenChange={(open) => !open && setReviewingOvertime(null)}>
          <DialogContent className="sm:max-w-[450px]">
            <DialogHeader>
              <DialogTitle>{overtimeReviewAction === 'approved' ? t("leaveManagement:overtime.reviewDialog.titleApprove") : t("leaveManagement:overtime.reviewDialog.titleReject")}</DialogTitle>
              <DialogDescription>
                {reviewingOvertime && t("leaveManagement:overtime.reviewDialog.descriptionLine", {
                  employee: reviewingOvertime.employee,
                  employeeId: reviewingOvertime.employeeId,
                  date: reviewingOvertime.date,
                  startTime: reviewingOvertime.startTime,
                  endTime: reviewingOvertime.endTime,
                  hours: reviewingOvertime.hours,
                })}
              </DialogDescription>
            </DialogHeader>
            {reviewingOvertime && (
              <div className="space-y-4 py-2">
                <div className="rounded-md bg-muted p-3 text-sm">
                  <p>{t("leaveManagement:overtime.reviewDialog.reasonLine", { reason: reviewingOvertime.reason })}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="overtimeReviewNote">{t("leaveManagement:overtime.reviewDialog.reviewNoteLabel")}</Label>
                  <Textarea
                    id="overtimeReviewNote"
                    rows={3}
                    placeholder={overtimeReviewAction === 'approved' ? t("leaveManagement:overtime.reviewDialog.reviewNotePlaceholderApprove") : t("leaveManagement:overtime.reviewDialog.reviewNotePlaceholderReject")}
                    value={overtimeReviewNote}
                    onChange={(e) => setOvertimeReviewNote(e.target.value)}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setReviewingOvertime(null)}>
                {t("common:actions.cancel")}
              </Button>
              <Button
                onClick={handleConfirmOvertimeReview}
                className={overtimeReviewAction === 'rejected' ? 'bg-red-600 hover:bg-red-700' : undefined}
              >
                {overtimeReviewAction === 'approved' ? t("leaveManagement:overtime.reviewDialog.confirmApprove") : t("leaveManagement:overtime.reviewDialog.confirmReject")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <TabsContent value="balance">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>{t("leaveManagement:balance.title")}</CardTitle>
                <CardDescription>
                  {t("leaveManagement:balance.description")}
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={recalculateAnnualLeave}>
                <RefreshCcw className="mr-2 h-4 w-4" /> {t("leaveManagement:balance.recalculate")}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("leaveManagement:balance.columns.employeeId")}</TableHead>
                      <TableHead>{t("leaveManagement:balance.columns.name")}</TableHead>
                      <TableHead>{t("leaveManagement:balance.columns.annualAvailable")}</TableHead>
                      <TableHead>{t("leaveManagement:balance.columns.annualUsed")}</TableHead>
                      <TableHead>{t("leaveManagement:balance.columns.sickAvailable")}</TableHead>
                      <TableHead>{t("leaveManagement:balance.columns.sickUsed")}</TableHead>
                      <TableHead>{t("leaveManagement:balance.columns.compAvailable")}</TableHead>
                      <TableHead>{t("leaveManagement:balance.columns.compUsed")}</TableHead>
                      <TableHead className="text-right">{t("leaveManagement:balance.columns.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaveBalances.map((balance) => (
                      <TableRow key={balance.id}>
                        <TableCell>{balance.employeeId}</TableCell>
                        <TableCell>{balance.employee}</TableCell>
                        <TableCell>{balance.annualLeave}</TableCell>
                        <TableCell>{balance.annualLeaveUsed}</TableCell>
                        <TableCell>{balance.sickLeave}</TableCell>
                        <TableCell>{balance.sickLeaveUsed}</TableCell>
                        <TableCell>{balance.compensatoryLeave}</TableCell>
                        <TableCell>{balance.compensatoryLeaveUsed}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => setViewingCompLedgerFor(balance)}>
                            {t("leaveManagement:balance.compLedgerButton")}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openAdjustDialog(balance)}>
                            {t("leaveManagement:balance.adjustButton")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <Dialog open={!!adjustingBalance} onOpenChange={(open) => !open && setAdjustingBalance(null)}>
          <DialogContent className="sm:max-w-[450px]">
            <DialogHeader>
              <DialogTitle>{t("leaveManagement:balance.adjustDialog.title")}</DialogTitle>
              <DialogDescription>
                {adjustingBalance && t("leaveManagement:balance.adjustDialog.descriptionLine", { employee: adjustingBalance.employee, employeeId: adjustingBalance.employeeId })}
              </DialogDescription>
            </DialogHeader>
            {adjustingBalance && (
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="adjustAnnualUsed">
                    {t("leaveManagement:balance.adjustDialog.annualUsedLabel", { days: adjustingBalance.annualLeave })}
                  </Label>
                  <Input
                    id="adjustAnnualUsed"
                    type="number"
                    min={0}
                    step={0.5}
                    disabled={!adjustingBalance.activePeriodId}
                    value={adjustForm.annualLeaveUsed}
                    onChange={(e) => setAdjustForm({ ...adjustForm, annualLeaveUsed: Number(e.target.value) })}
                  />
                  {!adjustingBalance.activePeriodId && (
                    <p className="text-xs text-muted-foreground">{t("leaveManagement:balance.adjustDialog.noActivePeriod")}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="adjustSick">{t("leaveManagement:balance.adjustDialog.sickAvailable")}</Label>
                    <Input
                      id="adjustSick"
                      type="number"
                      min={0}
                      value={adjustForm.sickLeave}
                      onChange={(e) => setAdjustForm({ ...adjustForm, sickLeave: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adjustSickUsed">{t("leaveManagement:balance.adjustDialog.sickUsed")}</Label>
                    <Input
                      id="adjustSickUsed"
                      type="number"
                      min={0}
                      value={adjustForm.sickLeaveUsed}
                      onChange={(e) => setAdjustForm({ ...adjustForm, sickLeaveUsed: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("leaveManagement:balance.adjustDialog.compHint")}
                </p>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setAdjustingBalance(null)}>
                {t("common:actions.cancel")}
              </Button>
              <Button onClick={handleConfirmAdjust}>{t("common:actions.save")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!viewingCompLedgerFor} onOpenChange={(open) => !open && setViewingCompLedgerFor(null)}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>{t("leaveManagement:balance.compLedgerDialog.title")}</DialogTitle>
              <DialogDescription>
                {viewingCompLedgerFor && t("leaveManagement:balance.compLedgerDialog.descriptionLine", { employee: viewingCompLedgerFor.employee, employeeId: viewingCompLedgerFor.employeeId })}
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("leaveManagement:balance.compLedgerDialog.columns.overtimeDate")}</TableHead>
                    <TableHead>{t("leaveManagement:balance.compLedgerDialog.columns.convertedHours")}</TableHead>
                    <TableHead>{t("leaveManagement:balance.compLedgerDialog.columns.used")}</TableHead>
                    <TableHead>{t("leaveManagement:balance.compLedgerDialog.columns.remaining")}</TableHead>
                    <TableHead>{t("leaveManagement:balance.compLedgerDialog.columns.deadline")}</TableHead>
                    <TableHead>{t("leaveManagement:balance.compLedgerDialog.columns.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {compTimeGrants.filter((g) => g.employeeId === viewingCompLedgerFor?.employeeId).length > 0 ? (
                    compTimeGrants
                      .filter((g) => g.employeeId === viewingCompLedgerFor?.employeeId)
                      .map((grant) => (
                        <TableRow key={grant.id}>
                          <TableCell>{grant.overtimeDate}</TableCell>
                          <TableCell>{grant.hours}</TableCell>
                          <TableCell>{grant.usedHours}</TableCell>
                          <TableCell>{(grant.hours - grant.usedHours).toFixed(1)}</TableCell>
                          <TableCell>{grant.deadline}</TableCell>
                          <TableCell>
                            {grant.settledAt
                              ? t("leaveManagement:balance.compLedgerDialog.statusSettled", { hours: grant.cashOutHours })
                              : new Date(grant.deadline) < new Date()
                              ? t("leaveManagement:balance.compLedgerDialog.statusOverdue")
                              : t("leaveManagement:balance.compLedgerDialog.statusAvailable")}
                          </TableCell>
                        </TableRow>
                      ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">
                        {t("leaveManagement:balance.compLedgerDialog.empty")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewingCompLedgerFor(null)}>
                {t("common:actions.close")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <TabsContent value="settlement">
          <Card>
            <CardHeader>
              <CardTitle>{t("leaveManagement:settlement.title")}</CardTitle>
              <CardDescription>
                {t("leaveManagement:settlement.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("leaveManagement:settlement.columns.employee")}</TableHead>
                      <TableHead>{t("leaveManagement:settlement.columns.period")}</TableHead>
                      <TableHead>{t("leaveManagement:settlement.columns.currentGrant")}</TableHead>
                      <TableHead>{t("leaveManagement:settlement.columns.carriedIn")}</TableHead>
                      <TableHead>{t("leaveManagement:settlement.columns.used")}</TableHead>
                      <TableHead>{t("leaveManagement:settlement.columns.mandatoryCashOut")}</TableHead>
                      <TableHead>{t("leaveManagement:settlement.columns.optionalCarryOrCashOut")}</TableHead>
                      <TableHead className="text-right">{t("leaveManagement:settlement.columns.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingSettlements.length > 0 ? (
                      pendingSettlements.map((period) => (
                        <TableRow key={period.id}>
                          <TableCell>{period.employee}（{period.employeeId}）</TableCell>
                          <TableCell>{period.periodStart} ~ {period.periodEnd}</TableCell>
                          <TableCell>{period.grantedDays}</TableCell>
                          <TableCell>{period.carriedInDays}</TableCell>
                          <TableCell>{period.usedDays}</TableCell>
                          <TableCell className="text-red-600">{period.mandatoryCashOutDays}</TableCell>
                          <TableCell>{period.remainingGrantDays}</TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" onClick={() => openSettleDialog(period)}>
                              {t("leaveManagement:settlement.settleButton")}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                          {t("leaveManagement:settlement.empty")}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Dialog open={!!settlingPeriod} onOpenChange={(open) => !open && setSettlingPeriod(null)}>
            <DialogContent className="sm:max-w-[450px]">
              <DialogHeader>
                <DialogTitle>{t("leaveManagement:settlement.settleDialog.title")}</DialogTitle>
                <DialogDescription>
                  {settlingPeriod && `${settlingPeriod.employee}（${settlingPeriod.employeeId}）${settlingPeriod.periodStart} ~ ${settlingPeriod.periodEnd}`}
                </DialogDescription>
              </DialogHeader>
              {settlingPeriod && (
                <div className="space-y-4 py-2">
                  <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                    <p>{t("leaveManagement:settlement.settleDialog.mandatoryLabel")}<strong>{settlingPeriod.mandatoryCashOutDays} {t("common:table.days")}</strong></p>
                    <p>{t("leaveManagement:settlement.settleDialog.optionalLabel")}<strong>{settlingPeriod.remainingGrantDays} {t("common:table.days")}</strong></p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="carryOverDays">{t("leaveManagement:settlement.settleDialog.carryOverLabel")}</Label>
                    <Input
                      id="carryOverDays"
                      type="number"
                      min={0}
                      max={settlingPeriod.remainingGrantDays}
                      step={0.5}
                      value={carryOverDays}
                      onChange={(e) => setCarryOverDays(Number(e.target.value))}
                    />
                  </div>
                  <div className="rounded-md border p-3 text-sm space-y-1">
                    <p>{t("leaveManagement:settlement.settleDialog.cashOutLabel")}<strong>{(settlingPeriod.mandatoryCashOutDays + settlingPeriod.remainingGrantDays - carryOverDays).toFixed(1)} {t("common:table.days")}</strong></p>
                    <p>
                      {t("leaveManagement:settlement.settleDialog.cashOutAmountLabel")}
                      <strong>
                        {settlingPeriod.monthlySalary
                          ? `NT$${Math.round((settlingPeriod.mandatoryCashOutDays + settlingPeriod.remainingGrantDays - carryOverDays) * (settlingPeriod.monthlySalary / 30)).toLocaleString()}`
                          : t("leaveManagement:settlement.settleDialog.noSalary")}
                      </strong>
                    </p>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setSettlingPeriod(null)}>
                  {t("common:actions.cancel")}
                </Button>
                <Button onClick={handleConfirmSettle}>{t("leaveManagement:settlement.settleDialog.confirm")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>{t("leaveManagement:compSettlement.title")}</CardTitle>
              <CardDescription>
                {t("leaveManagement:compSettlement.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("leaveManagement:compSettlement.columns.employee")}</TableHead>
                      <TableHead>{t("leaveManagement:compSettlement.columns.overtimeDate")}</TableHead>
                      <TableHead>{t("leaveManagement:compSettlement.columns.grantedHours")}</TableHead>
                      <TableHead>{t("leaveManagement:compSettlement.columns.used")}</TableHead>
                      <TableHead>{t("leaveManagement:compSettlement.columns.remainingPending")}</TableHead>
                      <TableHead>{t("leaveManagement:compSettlement.columns.deadline")}</TableHead>
                      <TableHead className="text-right">{t("leaveManagement:compSettlement.columns.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingCompSettlements.length > 0 ? (
                      pendingCompSettlements.map((grant) => (
                        <TableRow key={grant.id}>
                          <TableCell>{grant.employee}（{grant.employeeId}）</TableCell>
                          <TableCell>{grant.overtimeDate}</TableCell>
                          <TableCell>{grant.hours}</TableCell>
                          <TableCell>{grant.usedHours}</TableCell>
                          <TableCell className="text-red-600">{(grant.hours - grant.usedHours).toFixed(1)}</TableCell>
                          <TableCell>{grant.deadline}</TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" onClick={() => handleSettleComp(grant.id)}>
                              {t("leaveManagement:compSettlement.settleButton")}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                          {t("leaveManagement:compSettlement.empty")}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="grants">
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="md:col-span-1">
              <CardHeader>
                <CardTitle>{t("leaveManagement:grants.formTitle")}</CardTitle>
                <CardDescription>
                  {t("leaveManagement:grants.formDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="grantEmployeeId">{t("leaveManagement:grants.employeeLabel")}</Label>
                  <Select
                    value={grantForm.employeeId || ""}
                    onValueChange={(value) => setGrantForm({ ...grantForm, employeeId: value })}
                  >
                    <SelectTrigger id="grantEmployeeId">
                      <SelectValue placeholder={t("leaveManagement:grants.employeePlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((employee) => (
                        <SelectItem key={employee.id} value={employee.employeeId}>
                          {employee.name}（{employee.employeeId}）
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="grantLeaveType">{t("leaveManagement:grants.leaveTypeLabel")}</Label>
                  <Select
                    value={selectedGrantLeaveType}
                    onValueChange={(value) => {
                      setSelectedGrantLeaveType(value);
                      setGrantForm({ ...grantForm, leaveTypeId: parseInt(value) });
                    }}
                  >
                    <SelectTrigger id="grantLeaveType">
                      <SelectValue placeholder={t("leaveManagement:grants.leaveTypePlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {leaveTypes.filter((lt) => lt.needProof).map((type) => (
                        <SelectItem key={type.id} value={type.id.toString()}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="grantTotalDays">{t("leaveManagement:grants.totalDaysLabel")}</Label>
                  <Input
                    id="grantTotalDays"
                    type="number"
                    min={0}
                    step={0.5}
                    value={grantForm.totalDays ?? ""}
                    onChange={(e) => setGrantForm({ ...grantForm, totalDays: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="grantDeadline">{t("leaveManagement:grants.deadlineLabel")}</Label>
                  <Input
                    id="grantDeadline"
                    type="date"
                    value={grantForm.deadline || ""}
                    onChange={(e) => setGrantForm({ ...grantForm, deadline: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="grantNote">{t("leaveManagement:grants.noteLabel")}</Label>
                  <Input
                    id="grantNote"
                    placeholder={t("leaveManagement:grants.notePlaceholder")}
                    value={grantForm.note || ""}
                    onChange={(e) => setGrantForm({ ...grantForm, note: e.target.value })}
                  />
                </div>
                <Button onClick={handleCreateGrant} className="w-full">
                  {t("leaveManagement:grants.confirmButton")}
                </Button>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>{t("leaveManagement:grants.recordsTitle")}</CardTitle>
                <CardDescription>{t("leaveManagement:grants.recordsDescription")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("leaveManagement:grants.columns.employee")}</TableHead>
                        <TableHead>{t("leaveManagement:grants.columns.leaveType")}</TableHead>
                        <TableHead>{t("leaveManagement:grants.columns.granted")}</TableHead>
                        <TableHead>{t("leaveManagement:grants.columns.used")}</TableHead>
                        <TableHead>{t("leaveManagement:grants.columns.remaining")}</TableHead>
                        <TableHead>{t("leaveManagement:grants.columns.deadline")}</TableHead>
                        <TableHead>{t("leaveManagement:grants.columns.note")}</TableHead>
                        <TableHead className="text-right">{t("leaveManagement:grants.columns.actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaveGrants.length > 0 ? (
                        leaveGrants.map((grant) => (
                          <TableRow key={grant.id}>
                            <TableCell>{grant.employee}（{grant.employeeId}）</TableCell>
                            <TableCell>{grant.leaveTypeName}</TableCell>
                            <TableCell>{grant.totalDays}</TableCell>
                            <TableCell>{grant.usedDays}</TableCell>
                            <TableCell>{grant.totalDays - grant.usedDays}</TableCell>
                            <TableCell>{grant.deadline || t("leaveManagement:grants.noDeadline")}</TableCell>
                            <TableCell>{grant.note || "-"}</TableCell>
                            <TableCell className="text-right">
                              {grant.usedDays === 0 && (
                                <Button variant="ghost" size="icon" onClick={() => deleteLeaveGrant(grant.id)}>
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                            {t("leaveManagement:grants.empty")}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="types">
          <Card>
            <CardHeader>
              <CardTitle>{t("leaveManagement:types.title")}</CardTitle>
              <CardDescription>
                {t("leaveManagement:types.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("leaveManagement:types.columns.name")}</TableHead>
                      <TableHead>{t("leaveManagement:types.columns.code")}</TableHead>
                      <TableHead>{t("leaveManagement:types.columns.unit")}</TableHead>
                      <TableHead>{t("leaveManagement:types.columns.needProof")}</TableHead>
                      <TableHead>{t("leaveManagement:types.columns.affectAttendance")}</TableHead>
                      <TableHead>{t("leaveManagement:types.columns.paidStatus")}</TableHead>
                      <TableHead>{t("leaveManagement:types.columns.maxDays")}</TableHead>
                      <TableHead>{t("leaveManagement:types.columns.advanceApply")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaveTypes.map((type) => (
                      <TableRow key={type.id}>
                        <TableCell className="font-medium">{type.name}</TableCell>
                        <TableCell>{type.code}</TableCell>
                        <TableCell>{type.unit}</TableCell>
                        <TableCell>
                          {type.needProof ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                        </TableCell>
                        <TableCell>
                          {type.affectAttendance ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                        </TableCell>
                        <TableCell>
                          {type.isPaid ? t("leaveManagement:types.paid") : t("leaveManagement:types.unpaid")}
                        </TableCell>
                        <TableCell>{type.maxDays}</TableCell>
                        <TableCell>{type.advanceApply}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="holidays">
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="md:col-span-1">
              <CardHeader>
                <CardTitle>{t("leaveManagement:holidays.importTitle")}</CardTitle>
                <CardDescription>
                  {t("leaveManagement:holidays.importDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder={t("leaveManagement:holidays.csvPlaceholder")}
                  rows={8}
                  value={holidayCsv}
                  onChange={(e) => setHolidayCsv(e.target.value)}
                />
                <Button onClick={handleImportHolidays} disabled={!holidayCsv.trim()} className="w-full">
                  <Upload className="mr-2 h-4 w-4" /> {t("leaveManagement:holidays.importButton")}
                </Button>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>{t("leaveManagement:holidays.calendarTitle")}</CardTitle>
                  <CardDescription>
                    {t("leaveManagement:holidays.calendarDescription")}
                  </CardDescription>
                </div>
                <Select value={String(holidayYear)} onValueChange={(value) => setHolidayYear(Number(value))}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map((year) => (
                      <SelectItem key={year} value={String(year)}>{t("leaveManagement:holidays.yearOption", { year })}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-3">
                <HolidayCalendar
                  locale={calendarLocale}
                  month={holidayCalendarMonth}
                  onMonthChange={setHolidayCalendarMonth}
                  fromDate={new Date(holidayYear, 0, 1)}
                  toDate={new Date(holidayYear, 11, 31)}
                  modifiers={{ holiday: holidayDates, makeupWorkday: makeupWorkdayDates, regularWorkday: regularWorkdayDates }}
                  modifiersClassNames={{
                    holiday: "bg-green-100 text-green-700 hover:bg-green-200",
                    makeupWorkday: "bg-orange-100 text-orange-700 hover:bg-orange-200",
                    regularWorkday: "bg-gray-100 text-gray-600 hover:bg-gray-200",
                  }}
                  components={{
                    DayContent: ({ date }) => {
                      const holiday = holidayByDateKey.get(toDateKey(date));
                      return (
                        <span title={holiday?.name || undefined}>{date.getDate()}</span>
                      );
                    },
                  }}
                  className="rounded-md border"
                />
                <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-sm bg-green-100" /> {t("leaveManagement:holidays.isHoliday")}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-sm bg-orange-100" /> {t("leaveManagement:holidays.isWorkday")}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-sm bg-gray-100" /> {t("leaveManagement:holidays.isRegularWorkday")}
                  </span>
                  <span>{t("leaveManagement:holidays.calendarHoverHint")}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>{t("leaveManagement:holidays.listTitle")}</CardTitle>
              <CardDescription>
                {t("leaveManagement:holidays.listDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border max-h-[420px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("leaveManagement:holidays.columns.date")}</TableHead>
                      <TableHead>{t("leaveManagement:holidays.columns.description")}</TableHead>
                      <TableHead>{t("leaveManagement:holidays.columns.type")}</TableHead>
                      <TableHead className="text-right">{t("leaveManagement:holidays.columns.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {holidays.map((holiday) => (
                      <TableRow key={holiday.id}>
                        <TableCell>{holiday.date}</TableCell>
                        <TableCell>{holiday.name || "-"}</TableCell>
                        <TableCell>
                          {holiday.isHoliday ? (
                            <span className="text-green-600">{t("leaveManagement:holidays.isHoliday")}</span>
                          ) : isWeekendDate(holiday.date) ? (
                            <span className="text-orange-600">{t("leaveManagement:holidays.isWorkday")}</span>
                          ) : (
                            <span className="text-gray-500">{t("leaveManagement:holidays.isRegularWorkday")}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => deleteHoliday(holiday.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {holidays.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                          {t("leaveManagement:holidays.empty", { year: holidayYear })}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LeaveManagement;
