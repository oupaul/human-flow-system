
import { useState } from "react";
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
import { Calendar, Plus, FileText, CheckCircle2, XCircle, Loader2, RefreshCcw, Upload, Trash2, Clock } from "lucide-react";
import { useLeaveManagement } from "@/hooks/useLeaveManagement";
import { useOvertimeApplications } from "@/hooks/useOvertimeApplications";
import { useHolidays } from "@/hooks/useHolidays";
import { LeaveApplicationFormData } from "@/types/leave";
import { OvertimeApplicationFormData } from "@/types/overtime";

const LeaveManagement = () => {
  const {
    leaveTypes,
    leaveApplications,
    leaveBalances,
    loading,
    createLeaveApplication,
    updateApplicationStatus,
    recalculateAnnualLeave,
  } = useLeaveManagement();

  const {
    overtimeApplications,
    createOvertimeApplication,
    updateOvertimeStatus,
  } = useOvertimeApplications();

  const currentYear = new Date().getFullYear();
  const [holidayYear, setHolidayYear] = useState(currentYear);
  const { holidays, importHolidays, deleteHoliday } = useHolidays(holidayYear);
  const [holidayCsv, setHolidayCsv] = useState("");

  const [isAddLeaveOpen, setIsAddLeaveOpen] = useState(false);
  const [selectedLeaveType, setSelectedLeaveType] = useState("");
  const [formData, setFormData] = useState<Partial<LeaveApplicationFormData>>({
    unit: 'day'
  });

  const [isAddOvertimeOpen, setIsAddOvertimeOpen] = useState(false);
  const [overtimeFormData, setOvertimeFormData] = useState<Partial<OvertimeApplicationFormData>>({});

  const handleSubmitApplication = async () => {
    if (!formData.employeeId || !formData.leaveTypeId || !formData.startDate || !formData.endDate || !formData.reason) {
      return;
    }

    await createLeaveApplication(formData as LeaveApplicationFormData);
    setIsAddLeaveOpen(false);
    setFormData({ unit: 'day' });
    setSelectedLeaveType("");
  };

  const handleApprove = async (applicationId: number) => {
    await updateApplicationStatus(applicationId, 'approved', '系統管理員');
  };

  const handleReject = async (applicationId: number) => {
    await updateApplicationStatus(applicationId, 'rejected', '系統管理員');
  };

  const handleSubmitOvertime = async () => {
    if (!overtimeFormData.employeeId || !overtimeFormData.date || !overtimeFormData.startTime || !overtimeFormData.endTime || !overtimeFormData.reason) {
      return;
    }

    await createOvertimeApplication(overtimeFormData as OvertimeApplicationFormData);
    setIsAddOvertimeOpen(false);
    setOvertimeFormData({});
  };

  const handleApproveOvertime = async (id: number) => {
    await updateOvertimeStatus(id, 'approved', '系統管理員');
  };

  const handleRejectOvertime = async (id: number) => {
    await updateOvertimeStatus(id, 'rejected', '系統管理員');
  };

  const handleImportHolidays = async () => {
    if (!holidayCsv.trim()) return;
    await importHolidays(holidayCsv);
    setHolidayCsv("");
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

      <Tabs defaultValue="applications" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="applications">請假申請</TabsTrigger>
          <TabsTrigger value="overtime">加班申請</TabsTrigger>
          <TabsTrigger value="balance">假別餘額</TabsTrigger>
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
                        <TableCell>{application.days}</TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            {getStatusDisplay(application.status)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            {application.status === 'pending' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-green-600 hover:bg-green-50"
                                  onClick={() => handleApprove(application.id)}
                                >
                                  核准
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 hover:bg-red-50"
                                  onClick={() => handleReject(application.id)}
                                >
                                  拒絕
                                </Button>
                              </>
                            )}
                            <Button variant="ghost" size="icon">
                              <FileText className="h-4 w-4" />
                            </Button>
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
                          <div className="flex items-center">
                            {getStatusDisplay(application.status)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {application.status === 'pending' && (
                            <div className="flex gap-2 justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600 hover:bg-green-50"
                                onClick={() => handleApproveOvertime(application.id)}
                              >
                                核准
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:bg-red-50"
                                onClick={() => handleRejectOvertime(application.id)}
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
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
