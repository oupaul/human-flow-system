
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
import { Calendar, Plus, FileText, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useLeaveManagement } from "@/hooks/useLeaveManagement";
import { LeaveApplicationFormData } from "@/types/leave";

const LeaveManagement = () => {
  const { 
    leaveTypes, 
    leaveApplications, 
    leaveBalances, 
    loading, 
    createLeaveApplication,
    updateApplicationStatus 
  } = useLeaveManagement();
  
  const [isAddLeaveOpen, setIsAddLeaveOpen] = useState(false);
  const [selectedLeaveType, setSelectedLeaveType] = useState("");
  const [formData, setFormData] = useState<Partial<LeaveApplicationFormData>>({
    unit: 'day'
  });

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

      <Tabs defaultValue="applications" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="applications">請假申請</TabsTrigger>
          <TabsTrigger value="balance">假別餘額</TabsTrigger>
          <TabsTrigger value="types">假別設定</TabsTrigger>
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
        
        <TabsContent value="balance">
          <Card>
            <CardHeader>
              <CardTitle>員工假別餘額</CardTitle>
              <CardDescription>
                查看各員工剩餘假別天數
              </CardDescription>
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
      </Tabs>
    </div>
  );
};

export default LeaveManagement;
