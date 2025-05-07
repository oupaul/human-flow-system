
import { useState } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { 
  Pencil, 
  Plus, 
  Search, 
  Trash2, 
  FileText, 
  Filter,
  User,
  Phone,
  Mail,
  Calendar,
  Briefcase,
  Badge,
  UserX
} from "lucide-react";

// 模擬員工資料，增加了address和notes屬性的定義
const employeesData = [
  { id: 1, name: "張小明", employeeId: "EMP001", department: "IT部門", position: "軟體工程師", email: "ming@example.com", phone: "0912-345-678", joinDate: "2020-01-15", active: true, address: "", notes: "" },
  { id: 2, name: "李小華", employeeId: "EMP002", department: "人資部門", position: "人資專員", email: "hua@example.com", phone: "0923-456-789", joinDate: "2019-05-20", active: true, address: "", notes: "" },
  { id: 3, name: "王大明", employeeId: "EMP003", department: "財務部門", position: "會計師", email: "daming@example.com", phone: "0934-567-890", joinDate: "2021-03-10", active: true, address: "", notes: "" },
  { id: 4, name: "陳小玲", employeeId: "EMP004", department: "行銷部門", position: "行銷經理", email: "ling@example.com", phone: "0945-678-901", joinDate: "2018-11-05", active: false, terminationDate: "2023-06-30", terminationReason: "個人因素離職", address: "", notes: "" },
  { id: 5, name: "林小美", employeeId: "EMP005", department: "業務部門", position: "業務代表", email: "mei@example.com", phone: "0956-789-012", joinDate: "2022-02-15", active: true, address: "", notes: "" },
  { id: 6, name: "黃大力", employeeId: "EMP006", department: "IT部門", position: "系統管理員", email: "dali@example.com", phone: "0967-890-123", joinDate: "2020-08-20", active: true, address: "", notes: "" },
  { id: 7, name: "吳小菁", employeeId: "EMP007", department: "人資部門", position: "招聘專員", email: "jing@example.com", phone: "0978-901-234", joinDate: "2021-06-25", active: true, address: "", notes: "" },
  { id: 8, name: "趙小剛", employeeId: "EMP008", department: "財務部門", position: "財務分析師", email: "gang@example.com", phone: "0989-012-345", joinDate: "2019-09-30", active: false, terminationDate: "2024-01-15", terminationReason: "公司組織調整", address: "", notes: "" },
];

const departmentOptions = [
  { value: "all", label: "所有部門" },
  { value: "IT部門", label: "IT部門" },
  { value: "人資部門", label: "人資部門" },
  { value: "財務部門", label: "財務部門" },
  { value: "行銷部門", label: "行銷部門" },
  { value: "業務部門", label: "業務部門" },
];

const statusOptions = [
  { value: "all", label: "全部" },
  { value: "active", label: "在職" },
  { value: "inactive", label: "離職" },
];

// 修改 EmployeeFormData 接口，將所有屬性保持為必填
interface EmployeeFormData {
  id: number;
  name: string;
  employeeId: string;
  department: string;
  position: string;
  email: string;
  phone: string;
  joinDate: string;
  active: boolean;
  terminationDate: string;
  terminationReason: string;
  address: string;
  notes: string;
}

// 修改空表單數據對象，提供所有必填字段的默認值
const emptyFormData: EmployeeFormData = {
  id: 0,
  name: "",
  employeeId: "",
  department: "",
  position: "",
  email: "",
  phone: "",
  joinDate: "",
  active: true,
  terminationDate: "",
  terminationReason: "",
  address: "",
  notes: "",
};

const Employees = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const [isViewEmployeeOpen, setIsViewEmployeeOpen] = useState(false);
  const [isEditEmployeeOpen, setIsEditEmployeeOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isTerminateConfirmOpen, setIsTerminateConfirmOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeFormData | null>(null);
  const [formData, setFormData] = useState<EmployeeFormData>(emptyFormData);
  const { toast } = useToast();
  
  // 篩選員工資料
  const filteredEmployees = employeesData.filter((employee) => {
    const matchesSearch = 
      employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDepartment = 
      selectedDepartment === "all" || 
      employee.department === selectedDepartment;
    
    const matchesStatus =
      selectedStatus === "all" ||
      (selectedStatus === "active" && employee.active) ||
      (selectedStatus === "inactive" && !employee.active);
    
    return matchesSearch && matchesDepartment && matchesStatus;
  });

  // 處理表單輸入變更
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // 處理勾選框變更
  const handleSwitchChange = (name: string, checked: boolean) => {
    setFormData((prev) => ({ ...prev, [name]: checked }));
  };

  // 處理選擇變更
  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // 確保從員工數據轉換到表單數據時包含所有必要的字段
  const employeeToFormData = (employee: typeof employeesData[0]): EmployeeFormData => {
    return {
      ...employee,
      terminationDate: employee.terminationDate || "",
      terminationReason: employee.terminationReason || "",
      address: employee.address || "",
      notes: employee.notes || ""
    };
  };

  // 查看員工詳細資料
  const handleViewEmployee = (employee: typeof employeesData[0]) => {
    setSelectedEmployee(employeeToFormData(employee));
    setIsViewEmployeeOpen(true);
  };

  // 編輯員工資料
  const handleEditEmployee = (employee: typeof employeesData[0]) => {
    setSelectedEmployee(employeeToFormData(employee));
    setFormData(employeeToFormData(employee));
    setIsEditEmployeeOpen(true);
  };

  // 刪除員工
  const handleDeleteEmployee = (employee: typeof employeesData[0]) => {
    setSelectedEmployee(employeeToFormData(employee));
    setIsDeleteConfirmOpen(true);
  };

  // 確認刪除員工
  const confirmDeleteEmployee = () => {
    if (selectedEmployee) {
      toast({
        title: "刪除成功",
        description: `員工 ${selectedEmployee.name} (${selectedEmployee.employeeId}) 已被刪除。`,
      });
      setIsDeleteConfirmOpen(false);
    }
  };

  // 處理員工離職
  const handleTerminateEmployee = (employee: typeof employeesData[0]) => {
    const updatedEmployee = {
      ...employee,
      terminationDate: employee.terminationDate || new Date().toISOString().split('T')[0],
      terminationReason: employee.terminationReason || ""
    };
    setSelectedEmployee(employeeToFormData(updatedEmployee));
    setFormData(employeeToFormData(updatedEmployee));
    setIsTerminateConfirmOpen(true);
  };
  
  // 確認員工離職
  const confirmTerminateEmployee = () => {
    if (selectedEmployee) {
      toast({
        title: "狀態更新成功",
        description: `員工 ${selectedEmployee.name} (${selectedEmployee.employeeId}) 已標記為離職。`,
      });
      setIsTerminateConfirmOpen(false);
    }
  };

  // 新增員工
  const handleAddEmployee = () => {
    toast({
      title: "新增成功",
      description: `員工 ${formData.name} (${formData.employeeId}) 已新增。`,
    });
    setIsAddEmployeeOpen(false);
    setFormData(emptyFormData);
  };

  // 更新員工資料
  const handleUpdateEmployee = () => {
    if (selectedEmployee) {
      toast({
        title: "更新成功",
        description: `員工 ${formData.name} (${formData.employeeId}) 的資料已更新。`,
      });
      setIsEditEmployeeOpen(false);
    }
  };

  // 開啟新增員工對話框
  const openAddEmployeeDialog = () => {
    setFormData(emptyFormData);
    setIsAddEmployeeOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">員工管理</h1>
        <Button className="bg-hrms-accent" onClick={openAddEmployeeDialog}>
          <Plus className="mr-2 h-4 w-4" /> 新增員工
        </Button>
      </div>

      {/* 搜尋與篩選 */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜尋員工姓名、編號或電子郵件"
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <div className="flex items-center gap-2">
                <Label htmlFor="department-filter" className="whitespace-nowrap">
                  部門:
                </Label>
                <Select
                  value={selectedDepartment}
                  onValueChange={(value) => setSelectedDepartment(value)}
                >
                  <SelectTrigger id="department-filter" className="w-[140px]">
                    <SelectValue placeholder="選擇部門" />
                  </SelectTrigger>
                  <SelectContent>
                    {departmentOptions.map((dept) => (
                      <SelectItem key={dept.value} value={dept.value}>
                        {dept.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="status-filter" className="whitespace-nowrap">
                  狀態:
                </Label>
                <Select
                  value={selectedStatus}
                  onValueChange={(value) => setSelectedStatus(value)}
                >
                  <SelectTrigger id="status-filter" className="w-[100px]">
                    <SelectValue placeholder="選擇狀態" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 員工表格 */}
      <Card>
        <CardHeader>
          <CardTitle>員工列表</CardTitle>
          <CardDescription>
            共 {filteredEmployees.length} 位員工
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>員工編號</TableHead>
                  <TableHead>姓名</TableHead>
                  <TableHead>部門</TableHead>
                  <TableHead>職位</TableHead>
                  <TableHead>電子郵件</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.length > 0 ? (
                  filteredEmployees.map((employee) => (
                    <TableRow key={employee.id} className={!employee.active ? "bg-muted/30" : ""}>
                      <TableCell className="font-medium">{employee.employeeId}</TableCell>
                      <TableCell>
                        <HoverCard>
                          <HoverCardTrigger asChild>
                            <span className="cursor-pointer underline-offset-4 hover:underline">
                              {employee.name}
                            </span>
                          </HoverCardTrigger>
                          <HoverCardContent className="w-80">
                            <div className="flex justify-between space-x-4">
                              <div className="space-y-1">
                                <h4 className="text-sm font-semibold">{employee.name}</h4>
                                <div className="flex items-center pt-2">
                                  <Badge className="mr-2 h-4 w-4" />
                                  <span className="text-xs text-muted-foreground">{employee.employeeId}</span>
                                </div>
                                <div className="flex items-center pt-2">
                                  <Briefcase className="mr-2 h-4 w-4" />
                                  <span className="text-xs text-muted-foreground">{employee.position}, {employee.department}</span>
                                </div>
                                <div className="flex items-center pt-2">
                                  <Mail className="mr-2 h-4 w-4" />
                                  <span className="text-xs text-muted-foreground">{employee.email}</span>
                                </div>
                                <div className="flex items-center pt-2">
                                  <Phone className="mr-2 h-4 w-4" />
                                  <span className="text-xs text-muted-foreground">{employee.phone}</span>
                                </div>
                                <div className="flex items-center pt-2">
                                  <Calendar className="mr-2 h-4 w-4" />
                                  <span className="text-xs text-muted-foreground">
                                    {employee.active 
                                      ? `到職日: ${employee.joinDate}` 
                                      : `到職: ${employee.joinDate} | 離職: ${employee.terminationDate}`}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </HoverCardContent>
                        </HoverCard>
                      </TableCell>
                      <TableCell>{employee.department}</TableCell>
                      <TableCell>{employee.position}</TableCell>
                      <TableCell>{employee.email}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          employee.active 
                            ? "bg-green-50 text-green-700" 
                            : "bg-red-50 text-red-700"
                        }`}>
                          {employee.active ? "在職中" : "已離職"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleViewEmployee(employee)}
                            title="查看詳細資料"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleEditEmployee(employee)}
                            title="編輯資料"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {employee.active && (
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleTerminateEmployee(employee)}
                              title="標記為離職"
                            >
                              <UserX className="h-4 w-4 text-hrms-warning" />
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleDeleteEmployee(employee)}
                            title="刪除員工"
                          >
                            <Trash2 className="h-4 w-4 text-hrms-danger" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      沒有找到符合條件的員工
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 新增員工對話框 */}
      <Dialog open={isAddEmployeeOpen} onOpenChange={setIsAddEmployeeOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>新增員工</DialogTitle>
            <DialogDescription>
              填寫新員工的基本資料。所有帶*的欄位為必填。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">姓名 *</Label>
                <Input 
                  id="name" 
                  name="name"
                  placeholder="輸入姓名" 
                  value={formData.name}
                  onChange={handleFormChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="employeeId">員工編號 *</Label>
                <Input 
                  id="employeeId" 
                  name="employeeId"
                  placeholder="如: EMP001" 
                  value={formData.employeeId}
                  onChange={handleFormChange}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="department">部門 *</Label>
                <Select
                  value={formData.department}
                  onValueChange={(value) => handleSelectChange("department", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選擇部門" />
                  </SelectTrigger>
                  <SelectContent>
                    {departmentOptions.slice(1).map((dept) => (
                      <SelectItem key={dept.value} value={dept.value}>
                        {dept.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="position">職位 *</Label>
                <Input 
                  id="position" 
                  name="position"
                  placeholder="輸入職位" 
                  value={formData.position}
                  onChange={handleFormChange}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">電子郵件 *</Label>
                <Input 
                  id="email" 
                  name="email"
                  type="email" 
                  placeholder="name@example.com" 
                  value={formData.email}
                  onChange={handleFormChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">電話號碼</Label>
                <Input 
                  id="phone" 
                  name="phone"
                  placeholder="如: 0912-345-678" 
                  value={formData.phone}
                  onChange={handleFormChange}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="joinDate">到職日期 *</Label>
                <Input 
                  id="joinDate" 
                  name="joinDate"
                  type="date" 
                  value={formData.joinDate}
                  onChange={handleFormChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">地址</Label>
                <Input 
                  id="address" 
                  name="address"
                  placeholder="輸入地址" 
                  value={formData.address}
                  onChange={handleFormChange}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">備註</Label>
              <Textarea 
                id="notes" 
                name="notes"
                placeholder="輸入備註" 
                value={formData.notes}
                onChange={handleFormChange}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddEmployeeOpen(false)}>
              取消
            </Button>
            <Button onClick={handleAddEmployee}>
              儲存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 查看員工詳細資料 */}
      <Sheet open={isViewEmployeeOpen} onOpenChange={setIsViewEmployeeOpen}>
        <SheetContent className="sm:max-w-[540px]">
          <SheetHeader>
            <SheetTitle>員工詳細資料</SheetTitle>
            <SheetDescription>
              查看員工的完整資訊
            </SheetDescription>
          </SheetHeader>
          {selectedEmployee && (
            <div className="space-y-6 py-6">
              <div className="flex items-center justify-center mb-6">
                <div className={`h-24 w-24 rounded-full flex items-center justify-center ${
                  selectedEmployee.active 
                    ? "bg-hrms-accent" 
                    : "bg-gray-400"
                }`}>
                  <User className="h-12 w-12 text-white" />
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground mb-1">姓名</h4>
                    <p>{selectedEmployee.name}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground mb-1">員工編號</h4>
                    <p>{selectedEmployee.employeeId}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground mb-1">部門</h4>
                    <p>{selectedEmployee.department}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground mb-1">職位</h4>
                    <p>{selectedEmployee.position}</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground mb-1">電子郵件</h4>
                  <p>{selectedEmployee.email}</p>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground mb-1">電話號碼</h4>
                  <p>{selectedEmployee.phone}</p>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground mb-1">到職日期</h4>
                  <p>{selectedEmployee.joinDate}</p>
                </div>

                {!selectedEmployee.active && selectedEmployee.terminationDate && (
                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground mb-1">離職日期</h4>
                    <p>{selectedEmployee.terminationDate}</p>
                  </div>
                )}

                {!selectedEmployee.active && selectedEmployee.terminationReason && (
                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground mb-1">離職原因</h4>
                    <p>{selectedEmployee.terminationReason}</p>
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground mb-1">在職狀態</h4>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    selectedEmployee.active 
                      ? "bg-green-50 text-green-700" 
                      : "bg-red-50 text-red-700"
                  }`}>
                    {selectedEmployee.active ? "在職中" : "已離職"}
                  </span>
                </div>

                {selectedEmployee.address && (
                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground mb-1">地址</h4>
                    <p>{selectedEmployee.address}</p>
                  </div>
                )}

                {selectedEmployee.notes && (
                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground mb-1">備註</h4>
                    <p>{selectedEmployee.notes}</p>
                  </div>
                )}
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setIsViewEmployeeOpen(false)}>
                  關閉
                </Button>
                <Button onClick={() => {
                  setIsViewEmployeeOpen(false);
                  handleEditEmployee(selectedEmployee);
                }}>
                  編輯
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* 編輯員工資料 */}
      <Dialog open={isEditEmployeeOpen} onOpenChange={setIsEditEmployeeOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>編輯員工資料</DialogTitle>
            <DialogDescription>
              修改員工的基本資料。所有帶*的欄位為必填。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editName">姓名 *</Label>
                <Input 
                  id="editName" 
                  name="name"
                  placeholder="輸入姓名" 
                  value={formData.name}
                  onChange={handleFormChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editEmployeeId">員工編號 *</Label>
                <Input 
                  id="editEmployeeId" 
                  name="employeeId"
                  placeholder="如: EMP001" 
                  value={formData.employeeId}
                  onChange={handleFormChange}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editDepartment">部門 *</Label>
                <Select
                  value={formData.department}
                  onValueChange={(value) => handleSelectChange("department", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選擇部門" />
                  </SelectTrigger>
                  <SelectContent>
                    {departmentOptions.slice(1).map((dept) => (
                      <SelectItem key={dept.value} value={dept.value}>
                        {dept.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="editPosition">職位 *</Label>
                <Input 
                  id="editPosition" 
                  name="position"
                  placeholder="輸入職位" 
                  value={formData.position}
                  onChange={handleFormChange}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editEmail">電子郵件 *</Label>
                <Input 
                  id="editEmail" 
                  name="email"
                  type="email" 
                  placeholder="name@example.com" 
                  value={formData.email}
                  onChange={handleFormChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editPhone">電話號碼</Label>
                <Input 
                  id="editPhone" 
                  name="phone"
                  placeholder="如: 0912-345-678" 
                  value={formData.phone}
                  onChange={handleFormChange}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editJoinDate">到職日期 *</Label>
                <Input 
                  id="editJoinDate" 
                  name="joinDate"
                  type="date" 
                  value={formData.joinDate}
                  onChange={handleFormChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editAddress">地址</Label>
                <Input 
                  id="editAddress" 
                  name="address"
                  placeholder="輸入地址" 
                  value={formData.address}
                  onChange={handleFormChange}
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="active">在職狀態</Label>
              <Switch 
                id="active" 
                checked={formData.active} 
                onCheckedChange={(checked) => handleSwitchChange("active", checked)}
              />
              <span className="text-sm text-muted-foreground">
                {formData.active ? "在職中" : "已離職"}
              </span>
            </div>
            {!formData.active && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="editTerminationDate">離職日期</Label>
                  <Input 
                    id="editTerminationDate" 
                    name="terminationDate"
                    type="date" 
                    value={formData.terminationDate}
                    onChange={handleFormChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editTerminationReason">離職原因</Label>
                  <Textarea 
                    id="editTerminationReason" 
                    name="terminationReason"
                    placeholder="輸入離職原因" 
                    value={formData.terminationReason}
                    onChange={handleFormChange}
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="editNotes">備註</Label>
              <Textarea 
                id="editNotes" 
                name="notes"
                placeholder="輸入備註" 
                value={formData.notes}
                onChange={handleFormChange}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditEmployeeOpen(false)}>
              取消
            </Button>
            <Button onClick={handleUpdateEmployee}>
              儲存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 刪除員工確認對話框 */}
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除員工</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedEmployee && (
                <p>
                  您確定要刪除員工 <strong>{selectedEmployee.name} ({selectedEmployee.employeeId})</strong> 嗎？此操作無法復原。
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-red-600 hover:bg-red-700"
              onClick={confirmDeleteEmployee}
            >
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* 標記員工離職確認對話框 */}
      <AlertDialog open={isTerminateConfirmOpen} onOpenChange={setIsTerminateConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認標記員工為離職</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedEmployee && (
                <p>
                  您確定要將員工 <strong>{selectedEmployee.name} ({selectedEmployee.employeeId})</strong> 標記為已離職嗎？
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmTerminateEmployee}>
              確認
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Employees;
