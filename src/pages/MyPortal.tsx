import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Clock, Loader2, Paperclip, Plus, XCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLeaveManagement } from "@/hooks/useLeaveManagement";
import { useOvertimeApplications } from "@/hooks/useOvertimeApplications";
import { useLeaveGrants } from "@/hooks/useLeaveGrants";
import { LeaveApplicationFormData } from "@/types/leave";
import { OvertimeApplicationFormData } from "@/types/overtime";
import { leaveApi } from "@/services/leaveApi";

const getStatusDisplay = (status: string) => {
  switch (status) {
    case "approved":
      return (
        <span className="flex items-center text-green-600">
          <CheckCircle2 className="mr-1 h-4 w-4" /> 已核准
        </span>
      );
    case "rejected":
      return (
        <span className="flex items-center text-red-600">
          <XCircle className="mr-1 h-4 w-4" /> 已拒絕
        </span>
      );
    default:
      return <span className="text-yellow-600">待審核</span>;
  }
};

const MyPortal = () => {
  const { user } = useAuth();
  const { leaveTypes, leaveApplications, leaveBalances, loading: loadingLeave, createLeaveApplication } =
    useLeaveManagement();
  const { overtimeApplications, loading: loadingOvertime, createOvertimeApplication } =
    useOvertimeApplications();
  const { leaveGrants } = useLeaveGrants();

  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
  const [selectedLeaveType, setSelectedLeaveType] = useState("");
  const [leaveForm, setLeaveForm] = useState<Partial<LeaveApplicationFormData>>({ unit: "day" });
  const [leaveAttachment, setLeaveAttachment] = useState<File | null>(null);
  const selectedLeaveTypeNeedsProof = leaveTypes.find((t) => t.id.toString() === selectedLeaveType)?.needProof;

  const [isOvertimeDialogOpen, setIsOvertimeDialogOpen] = useState(false);
  const [overtimeForm, setOvertimeForm] = useState<Partial<OvertimeApplicationFormData>>({});

  const balance = leaveBalances[0];

  const handleSubmitLeave = async () => {
    if (!user?.employeeId || !leaveForm.leaveTypeId || !leaveForm.startDate || !leaveForm.endDate || !leaveForm.reason) {
      return;
    }
    await createLeaveApplication({ ...leaveForm, employeeId: user.employeeId } as LeaveApplicationFormData, leaveAttachment || undefined);
    setIsLeaveDialogOpen(false);
    setLeaveForm({ unit: "day" });
    setSelectedLeaveType("");
    setLeaveAttachment(null);
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

  const handleSubmitOvertime = async () => {
    if (!user?.employeeId || !overtimeForm.date || !overtimeForm.startTime || !overtimeForm.endTime || !overtimeForm.reason) {
      return;
    }
    await createOvertimeApplication({ ...overtimeForm, employeeId: user.employeeId } as OvertimeApplicationFormData);
    setIsOvertimeDialogOpen(false);
    setOvertimeForm({});
  };

  if (loadingLeave || loadingOvertime) {
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
        <h1 className="text-2xl font-bold tracking-tight">
          歡迎，{user?.employeeName || user?.username}
        </h1>
        <div className="flex gap-2">
          <Dialog open={isOvertimeDialogOpen} onOpenChange={setIsOvertimeDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Clock className="mr-2 h-4 w-4" /> 申請加班
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>加班申請</DialogTitle>
                <DialogDescription>填寫加班申請表，提交後將送交主管審核。</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="overtimeDate">加班日期</Label>
                  <Input
                    id="overtimeDate"
                    type="date"
                    value={overtimeForm.date || ""}
                    onChange={(e) => setOvertimeForm({ ...overtimeForm, date: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="overtimeStart">開始時間</Label>
                    <Input
                      id="overtimeStart"
                      type="time"
                      value={overtimeForm.startTime || ""}
                      onChange={(e) => setOvertimeForm({ ...overtimeForm, startTime: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="overtimeEnd">結束時間</Label>
                    <Input
                      id="overtimeEnd"
                      type="time"
                      value={overtimeForm.endTime || ""}
                      onChange={(e) => setOvertimeForm({ ...overtimeForm, endTime: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="overtimeReason">加班事由</Label>
                  <Textarea
                    id="overtimeReason"
                    rows={3}
                    value={overtimeForm.reason || ""}
                    onChange={(e) => setOvertimeForm({ ...overtimeForm, reason: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsOvertimeDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleSubmitOvertime}>提交申請</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isLeaveDialogOpen} onOpenChange={setIsLeaveDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-hrms-accent">
                <Plus className="mr-2 h-4 w-4" /> 申請請假
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>請假申請</DialogTitle>
                <DialogDescription>填寫請假申請表，提交後將送交主管審核。</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="leaveType">假別</Label>
                  <Select
                    value={selectedLeaveType}
                    onValueChange={(value) => {
                      setSelectedLeaveType(value);
                      setLeaveForm({ ...leaveForm, leaveTypeId: parseInt(value) });
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">開始日期</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={leaveForm.startDate || ""}
                      onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">結束日期</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={leaveForm.endDate || ""}
                      onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reason">請假事由</Label>
                  <Textarea
                    id="reason"
                    rows={3}
                    value={leaveForm.reason || ""}
                    onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deputy">職務代理人</Label>
                  <Input
                    id="deputy"
                    value={leaveForm.deputy || ""}
                    onChange={(e) => setLeaveForm({ ...leaveForm, deputy: e.target.value })}
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
                <Button variant="outline" onClick={() => setIsLeaveDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleSubmitLeave}>提交申請</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {balance && (
        <Card>
          <CardHeader>
            <CardTitle>我的假別餘額</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-sm text-muted-foreground">特休</p>
              <p className="text-xl font-bold">
                {balance.annualLeave - balance.annualLeaveUsed} / {balance.annualLeave}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">病假</p>
              <p className="text-xl font-bold">
                {balance.sickLeave - balance.sickLeaveUsed} / {balance.sickLeave}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">補休</p>
              <p className="text-xl font-bold">
                {balance.compensatoryLeave - balance.compensatoryLeaveUsed} / {balance.compensatoryLeave}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {leaveGrants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>我的假別核給</CardTitle>
            <CardDescription>喪假、婚假等由 HR 核給的假別額度與使用狀況</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>假別</TableHead>
                    <TableHead>核給</TableHead>
                    <TableHead>已用</TableHead>
                    <TableHead>剩餘</TableHead>
                    <TableHead>應休畢期限</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaveGrants.map((grant) => (
                    <TableRow key={grant.id}>
                      <TableCell>{grant.leaveTypeName}</TableCell>
                      <TableCell>{grant.totalDays}</TableCell>
                      <TableCell>{grant.usedDays}</TableCell>
                      <TableCell>{grant.totalDays - grant.usedDays}</TableCell>
                      <TableCell>{grant.deadline || "無期限"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>我的請假紀錄</CardTitle>
          <CardDescription>你所提交的請假申請與審核狀態</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>假別</TableHead>
                  <TableHead>開始日期</TableHead>
                  <TableHead>結束日期</TableHead>
                  <TableHead>天數</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead>附件</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaveApplications.length > 0 ? (
                  leaveApplications.map((application) => (
                    <TableRow key={application.id}>
                      <TableCell>{application.type}</TableCell>
                      <TableCell>{application.startDate}</TableCell>
                      <TableCell>{application.endDate}</TableCell>
                      <TableCell>{application.days}</TableCell>
                      <TableCell>
                        {getStatusDisplay(application.status)}
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
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      尚無請假紀錄
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>我的加班紀錄</CardTitle>
          <CardDescription>你所提交的加班申請與審核狀態</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>日期</TableHead>
                  <TableHead>時段</TableHead>
                  <TableHead>時數</TableHead>
                  <TableHead>狀態</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overtimeApplications.length > 0 ? (
                  overtimeApplications.map((application) => (
                    <TableRow key={application.id}>
                      <TableCell>{application.date}</TableCell>
                      <TableCell>
                        {application.startTime} - {application.endTime}
                      </TableCell>
                      <TableCell>{application.hours}</TableCell>
                      <TableCell>
                        {getStatusDisplay(application.status)}
                        {application.reviewNote && (
                          <p className="mt-1 text-xs text-muted-foreground">備註：{application.reviewNote}</p>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      尚無加班紀錄
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MyPortal;
