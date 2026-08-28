
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
import { Calendar, Plus, FileText, CheckCircle2, XCircle, Loader2, RefreshCcw, Upload, Trash2, Clock, Paperclip } from "lucide-react";
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
  const { user } = useAuth();
  const approverName = user?.employeeName || user?.username || "系統管理員";

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

  const [isAddLeaveOpen, setIsAddLeaveOpen] = useState(false);
  const [selectedLeaveType, setSelectedLeaveType] = useState("");
  const [formData, setFormData] = useState<Partial<LeaveApplicationFormData>>({
    unit: 'day'
  });
  const [leaveAttachment, setLeaveAttachment] = useState<File | null>(null);
  const selectedLeaveTypeInfo = leaveTypes.find((t) => t.id.toString() === selectedLeaveType);
  const selectedLeaveTypeNeedsProof = selectedLeaveTypeInfo?.needProof;
  const selectedLeaveTypeIsComp = selectedLeaveTypeInfo?.code === 'COMP';

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
            <span className="text-green-500">已核准</span>
          </>
        );
      case 'rejected':
        return (
          <>
            <XCircle className="mr-1 h-4 w-4 text-red-500" />
            <span className="text-red-500">已拒絕</span>
          </>
        );
      default:
        return <span className="text-yellow-500">待審核</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">載入中...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">假別管理</h1>
        <div className="flex gap-2">
        <Dialog open={isAddOvertimeOpen} onOpenChange={setIsAddOvertimeOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Clock className="mr-2 h-4 w-4" /> 申請加班
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>加班申請</DialogTitle>
              <DialogDescription>
                填寫加班申請表，提交後將送交主管審核。
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="overtimeEmployeeId">員工編號</Label>
                <Input
                  id="overtimeEmployeeId"
                  value={overtimeFormData.employeeId || ''}
                  onChange={(e) => setOvertimeFormData({ ...overtimeFormData, employeeId: e.target.value })}
                  placeholder="請輸入員工編號"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="overtimeDate">加班日期</Label>
                <Input
                  id="overtimeDate"
                  type="date"
                  value={overtimeFormData.date || ''}
                  onChange={(e) => setOvertimeFormData({ ...overtimeFormData, date: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="overtimeStart">開始時間</Label>
                  <Input
                    id="overtimeStart"
                    type="time"
                    value={overtimeFormData.startTime || ''}
                    onChange={(e) => setOvertimeFormData({ ...overtimeFormData, startTime: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="overtimeEnd">結束時間</Label>
                  <Input
                    id="overtimeEnd"
                    type="time"
                    value={overtimeFormData.endTime || ''}
                    onChange={(e) => setOvertimeFormData({ ...overtimeFormData, endTime: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="overtimeReason">加班事由</Label>
                <Textarea
                  id="overtimeReason"
                  placeholder="請簡要說明加班原因"
                  rows={3}
                  value={overtimeFormData.reason || ''}
                  onChange={(e) => setOvertimeFormData({ ...overtimeFormData, reason: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="overtimeCompensationType">領取方式</Label>
                <Select
                  value={overtimeFormData.compensationType || 'pay'}
                  onValueChange={(value: 'pay' | 'comp') => setOvertimeFormData({ ...overtimeFormData, compensationType: value })}
                >
                  <SelectTrigger id="overtimeCompensationType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pay">領加班費</SelectItem>
                    <SelectItem value="comp">換補休</SelectItem>
                  </SelectContent>
                </Select>
                {overtimeFormData.compensationType === 'comp' && (
                  <p className="text-xs text-muted-foreground">
                    依勞基法第 32-1 條，補休時數以工作時數 1:1 換算（加班多少小時、補休多少小時）。需在加班日起 6 個月內休畢，逾期未休完的部分會折算加班費。
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddOvertimeOpen(false)}>
                取消
              </Button>
              <Button onClick={handleSubmitOvertime}>
                提交申請
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={isAddLeaveOpen} onOpenChange={setIsAddLeaveOpen}>
          <DialogTrigger asChild>
            <Button className="bg-hrms-accent">
              <Plus className="mr-2 h-4 w-4" /> 申請請假
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[550px]">
            <DialogHeader>
              <DialogTitle>請假申請</DialogTitle>
              <DialogDescription>
                填寫請假申請表，提交後將送交主管審核。
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="employeeId">員工編號</Label>
                  <Input
                    id="employeeId"
                    value={formData.employeeId || ''}
                    onChange={(e) => setFormData({...formData, employeeId: e.target.value})}
                    placeholder="請輸入員工編號"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="leaveType">假別</Label>
                  <Select 
                    value={selectedLeaveType} 
                    onValueChange={(value) => {
                      setSelectedLeaveType(value);
                      setFormData({...formData, leaveTypeId: parseInt(value)});
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="選擇假別" />
                    </SelectTrigger>
                    <SelectContent>
                      {leaveTypes.map((type) => (
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
                        目前可用補休：{(enteredBalance.compensatoryLeave - enteredBalance.compensatoryLeaveUsed).toFixed(1)} 小時
                        {enteredBalance.compensatoryLeaveDeadline && `（最近一筆將於 ${enteredBalance.compensatoryLeaveDeadline} 到期）`}
                      </p>
                    );
                  })()}
                  <div className="space-y-2">
                    <Label htmlFor="compDate">補休日期</Label>
                    <Input
                      id="compDate"
                      type="date"
                      value={formData.startDate || ''}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value, endDate: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="compStartTime">開始時間</Label>
                      <Input
                        id="compStartTime"
                        type="time"
                        value={formData.startTime || ''}
                        onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="compEndTime">結束時間</Label>
                      <Input
                        id="compEndTime"
                        type="time"
                        value={formData.endTime || ''}
                        onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="unit">請假單位</Label>
                    <Select
                      value={formData.unit}
                      onValueChange={(value: 'day' | 'halfDay' | 'hour') => setFormData({...formData, unit: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="選擇單位" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="day">天</SelectItem>
                        <SelectItem value="halfDay">半天</SelectItem>
                        <SelectItem value="hour">小時</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startDate">開始日期</Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={formData.startDate || ''}
                        onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endDate">結束日期</Label>
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
                <Label htmlFor="reason">請假事由</Label>
                <Textarea
                  id="reason"
                  placeholder="請簡要說明請假原因"
                  rows={3}
                  value={formData.reason || ''}
                  onChange={(e) => setFormData({...formData, reason: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deputy">職務代理人</Label>
                <Input
                  id="deputy"
                  placeholder="請輸入職務代理人"
                  value={formData.deputy || ''}
                  onChange={(e) => setFormData({...formData, deputy: e.target.value})}
                />
              </div>
              {selectedLeaveTypeNeedsProof && (
                <div className="space-y-2">
                  <Label htmlFor="leaveAttachment">證明文件（此假別建議檢附證明文件）</Label>
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
                取消
              </Button>
              <Button onClick={handleSubmitApplication}>
                提交申請
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="applications">
            請假申請
            {pendingLeaveCount > 0 && (
              <span className="ml-1.5 rounded-full bg-hrms-warning px-1.5 py-0.5 text-xs font-semibold text-white">
                {pendingLeaveCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="overtime">
            加班申請
            {pendingOvertimeCount > 0 && (
              <span className="ml-1.5 rounded-full bg-hrms-warning px-1.5 py-0.5 text-xs font-semibold text-white">
                {pendingOvertimeCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="balance">假別餘額</TabsTrigger>
          <TabsTrigger value="settlement">特休結算</TabsTrigger>
          <TabsTrigger value="grants">假別核給</TabsTrigger>
          <TabsTrigger value="types">假別設定</TabsTrigger>
          <TabsTrigger value="holidays">國定假日</TabsTrigger>
        </TabsList>
        
        <TabsContent value="applications">
          <Card>
            <CardHeader>
              <CardTitle>請假申請列表</CardTitle>
              <CardDescription>
                所有員工的請假申請紀錄和審核狀態
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>員工編號</TableHead>
                      <TableHead>姓名</TableHead>
                      <TableHead>假別</TableHead>
                      <TableHead>開始日期</TableHead>
                      <TableHead>結束日期</TableHead>
                      <TableHead>天數</TableHead>
                      <TableHead>狀態</TableHead>
                      <TableHead>附件</TableHead>
                      <TableHead className="text-right">操作</TableHead>
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
                        <TableCell>{application.days}{application.type === '補休' ? ' 小時' : ' 天'}</TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            {getStatusDisplay(application.status)}
                          </div>
                          {application.reviewNote && (
                            <p className="mt-1 text-xs text-muted-foreground">備註：{application.reviewNote}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          {application.attachment ? (
                            <Button variant="ghost" size="icon" onClick={() => handleViewAttachment(application.id)} title="查看附件">
                              <Paperclip className="h-4 w-4" />
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-xs">無</span>
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
                                  核准
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 hover:bg-red-50"
                                  onClick={() => openReviewDialog(application, 'rejected')}
                                >
                                  拒絕
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
              <DialogTitle>{reviewAction === 'approved' ? '核准' : '拒絕'}請假申請</DialogTitle>
              <DialogDescription>
                {reviewingApplication && `${reviewingApplication.employee}（${reviewingApplication.employeeId}）· ${reviewingApplication.type} · ${reviewingApplication.startDate} ~ ${reviewingApplication.endDate}`}
              </DialogDescription>
            </DialogHeader>
            {reviewingApplication && (
              <div className="space-y-4 py-2">
                <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                  <p>申請事由：{reviewingApplication.reason}</p>
                  {reviewingApplication.attachment && (
                    <Button variant="link" className="h-auto p-0" onClick={() => handleViewAttachment(reviewingApplication.id)}>
                      <Paperclip className="mr-1 h-3 w-3" /> 查看附件
                    </Button>
                  )}
                </div>
                {reviewAction === 'approved' && reviewingApplication.grantId && (() => {
                  const grant = leaveGrants.find((g) => g.id === reviewingApplication.grantId);
                  return grant ? (
                    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
                      此申請已關聯核給紀錄，剩餘 <strong>{grant.totalDays - grant.usedDays}</strong> 天（核給 {grant.totalDays} 天，期限 {grant.deadline || "無"}），核准天數不可超過剩餘天數。
                    </div>
                  ) : null;
                })()}
                {reviewAction === 'approved' && reviewingApplication.type === '補休' && (() => {
                  const balance = leaveBalances.find((b) => b.employeeId === reviewingApplication.employeeId);
                  if (!balance) return null;
                  return (
                    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
                      目前可用補休 <strong>{(balance.compensatoryLeave - balance.compensatoryLeaveUsed).toFixed(1)}</strong> 小時，核准時數不可超過剩餘時數（依到期日近到遠自動扣抵）。
                    </div>
                  );
                })()}
                {reviewAction === 'approved' && (
                  <div className="space-y-2">
                    <Label htmlFor="approvedDays">
                      {reviewingApplication.type === '補休' ? '核准時數（小時）' : '核准天數（可依證明文件調整，例如喪假依親屬關係核定天數）'}
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
                  <Label htmlFor="reviewNote">審核備註（選填）</Label>
                  <Textarea
                    id="reviewNote"
                    rows={3}
                    placeholder={reviewAction === 'approved' ? '例如：已確認證明文件' : '請說明拒絕原因，員工會看到這則備註'}
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setReviewingApplication(null)}>
                取消
              </Button>
              <Button
                onClick={handleConfirmReview}
                className={reviewAction === 'rejected' ? 'bg-red-600 hover:bg-red-700' : undefined}
              >
                確認{reviewAction === 'approved' ? '核准' : '拒絕'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <TabsContent value="overtime">
          <Card>
            <CardHeader>
              <CardTitle>加班申請列表</CardTitle>
              <CardDescription>
                所有員工的加班申請紀錄和審核狀態
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>員工編號</TableHead>
                      <TableHead>姓名</TableHead>
                      <TableHead>日期</TableHead>
                      <TableHead>時段</TableHead>
                      <TableHead>時數</TableHead>
                      <TableHead>假日加班</TableHead>
                      <TableHead>領取方式</TableHead>
                      <TableHead>狀態</TableHead>
                      <TableHead className="text-right">操作</TableHead>
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
                            ? `換補休${application.compHours ? `（${application.compHours} 小時）` : ''}`
                            : '領加班費'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            {getStatusDisplay(application.status)}
                          </div>
                          {application.reviewNote && (
                            <p className="mt-1 text-xs text-muted-foreground">備註：{application.reviewNote}</p>
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
                                核准
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:bg-red-50"
                                onClick={() => openOvertimeReviewDialog(application, 'rejected')}
                              >
                                拒絕
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
              <DialogTitle>{overtimeReviewAction === 'approved' ? '核准' : '拒絕'}加班申請</DialogTitle>
              <DialogDescription>
                {reviewingOvertime && `${reviewingOvertime.employee}（${reviewingOvertime.employeeId}）· ${reviewingOvertime.date} ${reviewingOvertime.startTime}-${reviewingOvertime.endTime}（${reviewingOvertime.hours} 小時）`}
              </DialogDescription>
            </DialogHeader>
            {reviewingOvertime && (
              <div className="space-y-4 py-2">
                <div className="rounded-md bg-muted p-3 text-sm">
                  <p>加班事由：{reviewingOvertime.reason}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="overtimeReviewNote">審核備註（選填）</Label>
                  <Textarea
                    id="overtimeReviewNote"
                    rows={3}
                    placeholder={overtimeReviewAction === 'approved' ? '例如：已確認加班事由' : '請說明拒絕原因，員工會看到這則備註'}
                    value={overtimeReviewNote}
                    onChange={(e) => setOvertimeReviewNote(e.target.value)}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setReviewingOvertime(null)}>
                取消
              </Button>
              <Button
                onClick={handleConfirmOvertimeReview}
                className={overtimeReviewAction === 'rejected' ? 'bg-red-600 hover:bg-red-700' : undefined}
              >
                確認{overtimeReviewAction === 'approved' ? '核准' : '拒絕'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <TabsContent value="balance">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>員工假別餘額</CardTitle>
                <CardDescription>
                  查看各員工剩餘假別天數
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={recalculateAnnualLeave}>
                <RefreshCcw className="mr-2 h-4 w-4" /> 依到職日重新計算特休
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>員工編號</TableHead>
                      <TableHead>姓名</TableHead>
                      <TableHead>特休可用</TableHead>
                      <TableHead>特休已用</TableHead>
                      <TableHead>病假可用</TableHead>
                      <TableHead>病假已用</TableHead>
                      <TableHead>補休可用</TableHead>
                      <TableHead>補休已用</TableHead>
                      <TableHead className="text-right">操作</TableHead>
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
                            補休明細
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openAdjustDialog(balance)}>
                            調整
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
              <DialogTitle>調整假別餘額</DialogTitle>
              <DialogDescription>
                {adjustingBalance && `${adjustingBalance.employee}（${adjustingBalance.employeeId}）`}
              </DialogDescription>
            </DialogHeader>
            {adjustingBalance && (
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="adjustAnnualUsed">
                    特休已用天數（可用天數 {adjustingBalance.annualLeave} 天由到職年資自動計算，這裡只能調整「已用」）
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
                    <p className="text-xs text-muted-foreground">此員工尚無特休週年紀錄，無法調整</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="adjustSick">病假可用</Label>
                    <Input
                      id="adjustSick"
                      type="number"
                      min={0}
                      value={adjustForm.sickLeave}
                      onChange={(e) => setAdjustForm({ ...adjustForm, sickLeave: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adjustSickUsed">病假已用</Label>
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
                  補休可用／已用時數改由加班核准與請假使用自動計算，不再開放手動調整；請至「補休明細」查看來源。
                </p>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setAdjustingBalance(null)}>
                取消
              </Button>
              <Button onClick={handleConfirmAdjust}>儲存</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!viewingCompLedgerFor} onOpenChange={(open) => !open && setViewingCompLedgerFor(null)}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>補休明細</DialogTitle>
              <DialogDescription>
                {viewingCompLedgerFor && `${viewingCompLedgerFor.employee}（${viewingCompLedgerFor.employeeId}）`}
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>加班日期</TableHead>
                    <TableHead>換算時數</TableHead>
                    <TableHead>已用</TableHead>
                    <TableHead>剩餘</TableHead>
                    <TableHead>應休畢期限</TableHead>
                    <TableHead>狀態</TableHead>
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
                              ? `已結算（折算 ${grant.cashOutHours} 小時）`
                              : new Date(grant.deadline) < new Date()
                              ? "已逾期，待 HR 結算"
                              : "可使用"}
                          </TableCell>
                        </TableRow>
                      ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">
                        尚無補休紀錄
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewingCompLedgerFor(null)}>
                關閉
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <TabsContent value="settlement">
          <Card>
            <CardHeader>
              <CardTitle>特休週年結算</CardTitle>
              <CardDescription>
                已到期但尚未結算的特休週年期間。依勞基法第 38 條，本期新發放且尚未休完的天數可選擇遞延一次或折現；上一期遞延進來仍未休完的天數則必須全數折現。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>員工</TableHead>
                      <TableHead>週年區間</TableHead>
                      <TableHead>本期發放</TableHead>
                      <TableHead>上期遞延</TableHead>
                      <TableHead>已用</TableHead>
                      <TableHead>應強制折現</TableHead>
                      <TableHead>可選遞延/折現</TableHead>
                      <TableHead className="text-right">操作</TableHead>
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
                              結算
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                          目前沒有待結算的週年期間
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
                <DialogTitle>結算特休週年</DialogTitle>
                <DialogDescription>
                  {settlingPeriod && `${settlingPeriod.employee}（${settlingPeriod.employeeId}）${settlingPeriod.periodStart} ~ ${settlingPeriod.periodEnd}`}
                </DialogDescription>
              </DialogHeader>
              {settlingPeriod && (
                <div className="space-y-4 py-2">
                  <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                    <p>應強制折現（上期遞延未休完）：<strong>{settlingPeriod.mandatoryCashOutDays} 天</strong></p>
                    <p>本期可選遞延或折現：<strong>{settlingPeriod.remainingGrantDays} 天</strong></p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="carryOverDays">選擇遞延到下一期的天數（其餘自動折現）</Label>
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
                    <p>將折現天數：<strong>{(settlingPeriod.mandatoryCashOutDays + settlingPeriod.remainingGrantDays - carryOverDays).toFixed(1)} 天</strong></p>
                    <p>
                      預估折現金額：
                      <strong>
                        {settlingPeriod.monthlySalary
                          ? `NT$${Math.round((settlingPeriod.mandatoryCashOutDays + settlingPeriod.remainingGrantDays - carryOverDays) * (settlingPeriod.monthlySalary / 30)).toLocaleString()}`
                          : "尚未設定月薪，無法試算"}
                      </strong>
                    </p>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setSettlingPeriod(null)}>
                  取消
                </Button>
                <Button onClick={handleConfirmSettle}>確認結算</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>補休結算</CardTitle>
              <CardDescription>
                已逾期（超過加班日起 6 個月）但尚未休完的補休額度，剩餘時數需全數折算加班費發放。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>員工</TableHead>
                      <TableHead>加班日期</TableHead>
                      <TableHead>核給時數</TableHead>
                      <TableHead>已用</TableHead>
                      <TableHead>剩餘（待折現）</TableHead>
                      <TableHead>應休畢期限</TableHead>
                      <TableHead className="text-right">操作</TableHead>
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
                              結算
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                          目前沒有待結算的補休額度
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
                <CardTitle>新增假別核給</CardTitle>
                <CardDescription>
                  適用喪假、婚假等「同一事由分次請假」的假別。審核過員工提供的證明文件後，直接核給總天數與應休畢期限，之後同一員工、同一假別的請假申請會自動從這筆核給扣抵，超過剩餘天數會被擋下。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="grantEmployeeId">員工</Label>
                  <Select
                    value={grantForm.employeeId || ""}
                    onValueChange={(value) => setGrantForm({ ...grantForm, employeeId: value })}
                  >
                    <SelectTrigger id="grantEmployeeId">
                      <SelectValue placeholder="選擇員工" />
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
                  <Label htmlFor="grantLeaveType">假別</Label>
                  <Select
                    value={selectedGrantLeaveType}
                    onValueChange={(value) => {
                      setSelectedGrantLeaveType(value);
                      setGrantForm({ ...grantForm, leaveTypeId: parseInt(value) });
                    }}
                  >
                    <SelectTrigger id="grantLeaveType">
                      <SelectValue placeholder="選擇假別" />
                    </SelectTrigger>
                    <SelectContent>
                      {leaveTypes.filter((t) => t.needProof).map((type) => (
                        <SelectItem key={type.id} value={type.id.toString()}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="grantTotalDays">核給天數</Label>
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
                  <Label htmlFor="grantDeadline">應休畢期限（選填）</Label>
                  <Input
                    id="grantDeadline"
                    type="date"
                    value={grantForm.deadline || ""}
                    onChange={(e) => setGrantForm({ ...grantForm, deadline: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="grantNote">備註（選填）</Label>
                  <Input
                    id="grantNote"
                    placeholder="如：父喪，依親屬關係核給 8 天"
                    value={grantForm.note || ""}
                    onChange={(e) => setGrantForm({ ...grantForm, note: e.target.value })}
                  />
                </div>
                <Button onClick={handleCreateGrant} className="w-full">
                  確認核給
                </Button>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>核給紀錄</CardTitle>
                <CardDescription>已核給的假別額度與使用狀況</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>員工</TableHead>
                        <TableHead>假別</TableHead>
                        <TableHead>核給</TableHead>
                        <TableHead>已用</TableHead>
                        <TableHead>剩餘</TableHead>
                        <TableHead>期限</TableHead>
                        <TableHead>備註</TableHead>
                        <TableHead className="text-right">操作</TableHead>
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
                            <TableCell>{grant.deadline || "無期限"}</TableCell>
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
                            尚無核給紀錄
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
              <CardTitle>假別設定</CardTitle>
              <CardDescription>
                管理系統中的假別類型和規則
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>假別名稱</TableHead>
                      <TableHead>假別代碼</TableHead>
                      <TableHead>計算單位</TableHead>
                      <TableHead>需要證明</TableHead>
                      <TableHead>影響全勤</TableHead>
                      <TableHead>薪資計算</TableHead>
                      <TableHead>最大天數</TableHead>
                      <TableHead>提前申請</TableHead>
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
                          {type.isPaid ? "有薪" : "無薪"}
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
                <CardTitle>匯入國定假日</CardTitle>
                <CardDescription>
                  貼上人事行政總處「政府行政機關辦公日曆表」CSV 內容（可至政府資料開放平台下載）
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder={"西元日期,星期,是否放假,備註\n20260101,四,2,中華民國開國紀念日"}
                  rows={8}
                  value={holidayCsv}
                  onChange={(e) => setHolidayCsv(e.target.value)}
                />
                <Button onClick={handleImportHolidays} disabled={!holidayCsv.trim()} className="w-full">
                  <Upload className="mr-2 h-4 w-4" /> 匯入
                </Button>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>假日列表</CardTitle>
                  <CardDescription>
                    已匯入的國定假日與補班日
                  </CardDescription>
                </div>
                <Select value={String(holidayYear)} onValueChange={(value) => setHolidayYear(Number(value))}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map((year) => (
                      <SelectItem key={year} value={String(year)}>{year} 年</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border max-h-[420px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>日期</TableHead>
                        <TableHead>說明</TableHead>
                        <TableHead>類型</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {holidays.map((holiday) => (
                        <TableRow key={holiday.id}>
                          <TableCell>{holiday.date}</TableCell>
                          <TableCell>{holiday.name || "-"}</TableCell>
                          <TableCell>
                            {holiday.isHoliday ? (
                              <span className="text-green-600">放假</span>
                            ) : (
                              <span className="text-orange-600">補班</span>
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
                            {holidayYear} 年尚無假日資料，請於左側匯入
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
      </Tabs>
    </div>
  );
};

export default LeaveManagement;
