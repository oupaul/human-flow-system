
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
import { Calendar, Plus, FileText, CheckCircle2, XCircle } from "lucide-react";

// Mock leave types
const leaveTypes = [
  { id: 1, name: "特休", code: "AL", unit: "天", needProof: false, affectAttendance: false, isPaid: true, maxDays: "依年資", advanceApply: "3天", canSplit: true },
  { id: 2, name: "事假", code: "PL", unit: "小時", needProof: false, affectAttendance: true, isPaid: false, maxDays: "14天", advanceApply: "3天", canSplit: true },
  { id: 3, name: "病假", code: "SL", unit: "天", needProof: true, affectAttendance: false, isPaid: false, maxDays: "30天", advanceApply: "當天", canSplit: true },
  { id: 4, name: "婚假", code: "ML", unit: "天", needProof: true, affectAttendance: false, isPaid: true, maxDays: "8天", advanceApply: "7天", canSplit: false },
  { id: 5, name: "公假", code: "OL", unit: "天", needProof: true, affectAttendance: false, isPaid: true, maxDays: "依需求", advanceApply: "3天", canSplit: true },
  { id: 6, name: "喪假", code: "BL", unit: "天", needProof: true, affectAttendance: false, isPaid: true, maxDays: "依親屬關係", advanceApply: "當天", canSplit: true },
];

// Mock leave applications
const leaveApplications = [
  { id: 1, employee: "張小明", employeeId: "EMP001", type: "特休", startDate: "2023-05-10", endDate: "2023-05-12", days: 3, reason: "家庭旅遊", status: "已核准", approver: "李主管" },
  { id: 2, employee: "李小華", employeeId: "EMP002", type: "病假", startDate: "2023-05-15", endDate: "2023-05-15", days: 1, reason: "感冒就醫", status: "已核准", approver: "王主管" },
  { id: 3, employee: "王大明", employeeId: "EMP003", type: "事假", startDate: "2023-05-18", endDate: "2023-05-18", days: 0.5, reason: "個人事務", status: "待審核", approver: "" },
  { id: 4, employee: "陳小玲", employeeId: "EMP004", type: "婚假", startDate: "2023-06-01", endDate: "2023-06-08", days: 8, reason: "結婚", status: "待審核", approver: "" },
  { id: 5, employee: "林小美", employeeId: "EMP005", type: "喪假", startDate: "2023-05-20", endDate: "2023-05-23", days: 4, reason: "祖父過世", status: "待審核", approver: "" },
];

// Mock leave balance
const leaveBalance = [
  { id: 1, employee: "張小明", employeeId: "EMP001", annualLeave: 10, annualLeaveUsed: 3, sickLeave: 30, sickLeaveUsed: 0, compensatoryLeave: 2, compensatoryLeaveUsed: 0 },
  { id: 2, employee: "李小華", employeeId: "EMP002", annualLeave: 7, annualLeaveUsed: 0, sickLeave: 30, sickLeaveUsed: 1, compensatoryLeave: 0, compensatoryLeaveUsed: 0 },
  { id: 3, employee: "王大明", employeeId: "EMP003", annualLeave: 14, annualLeaveUsed: 5, sickLeave: 30, sickLeaveUsed: 2, compensatoryLeave: 1, compensatoryLeaveUsed: 0 },
  { id: 4, employee: "陳小玲", employeeId: "EMP004", annualLeave: 21, annualLeaveUsed: 10, sickLeave: 30, sickLeaveUsed: 4, compensatoryLeave: 3, compensatoryLeaveUsed: 2 },
  { id: 5, employee: "林小美", employeeId: "EMP005", annualLeave: 3, annualLeaveUsed: 0, sickLeave: 30, sickLeaveUsed: 0, compensatoryLeave: 0, compensatoryLeaveUsed: 0 },
];

const LeaveManagement = () => {
  const [isAddLeaveOpen, setIsAddLeaveOpen] = useState(false);
  const [selectedLeaveType, setSelectedLeaveType] = useState("");

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
                  <Label htmlFor="leaveType">假別</Label>
                  <Select value={selectedLeaveType} onValueChange={setSelectedLeaveType}>
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
                <div className="space-y-2">
                  <Label htmlFor="unit">請假單位</Label>
                  <Select defaultValue="day">
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
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">開始日期</Label>
                  <div className="flex items-center">
                    <Input id="startDate" type="date" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">結束日期</Label>
                  <div className="flex items-center">
                    <Input id="endDate" type="date" />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startTime">開始時間</Label>
                  <Input id="startTime" type="time" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime">結束時間</Label>
                  <Input id="endTime" type="time" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">請假事由</Label>
                <Textarea
                  id="reason"
                  placeholder="請簡要說明請假原因"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deputy">職務代理人</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="選擇職務代理人" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="emp001">張小明</SelectItem>
                    <SelectItem value="emp002">李小華</SelectItem>
                    <SelectItem value="emp003">王大明</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {selectedLeaveType === "3" && (
                <div className="space-y-2">
                  <Label htmlFor="attachment">上傳證明文件</Label>
                  <Input id="attachment" type="file" />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddLeaveOpen(false)}>
                取消
              </Button>
              <Button onClick={() => setIsAddLeaveOpen(false)}>
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
        
        {/* 請假申請 Tab */}
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
                            {application.status === "已核准" ? (
                              <>
                                <CheckCircle2 className="mr-1 h-4 w-4 text-green-500" />
                                <span className="text-green-500">{application.status}</span>
                              </>
                            ) : application.status === "已拒絕" ? (
                              <>
                                <XCircle className="mr-1 h-4 w-4 text-red-500" />
                                <span className="text-red-500">{application.status}</span>
                              </>
                            ) : (
                              <span className="text-yellow-500">{application.status}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon">
                            <FileText className="h-4 w-4" />
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
        
        {/* 假別餘額 Tab */}
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
                    {leaveBalance.map((balance) => (
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
        
        {/* 假別設定 Tab */}
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
