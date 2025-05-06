
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
  Pencil, 
  Plus, 
  Search, 
  Trash2, 
  FileText, 
  Filter 
} from "lucide-react";

// Mock data
const employeesData = [
  { id: 1, name: "張小明", employeeId: "EMP001", department: "IT部門", position: "軟體工程師", email: "ming@example.com", phone: "0912-345-678", joinDate: "2020-01-15" },
  { id: 2, name: "李小華", employeeId: "EMP002", department: "人資部門", position: "人資專員", email: "hua@example.com", phone: "0923-456-789", joinDate: "2019-05-20" },
  { id: 3, name: "王大明", employeeId: "EMP003", department: "財務部門", position: "會計師", email: "daming@example.com", phone: "0934-567-890", joinDate: "2021-03-10" },
  { id: 4, name: "陳小玲", employeeId: "EMP004", department: "行銷部門", position: "行銷經理", email: "ling@example.com", phone: "0945-678-901", joinDate: "2018-11-05" },
  { id: 5, name: "林小美", employeeId: "EMP005", department: "業務部門", position: "業務代表", email: "mei@example.com", phone: "0956-789-012", joinDate: "2022-02-15" },
  { id: 6, name: "黃大力", employeeId: "EMP006", department: "IT部門", position: "系統管理員", email: "dali@example.com", phone: "0967-890-123", joinDate: "2020-08-20" },
  { id: 7, name: "吳小菁", employeeId: "EMP007", department: "人資部門", position: "招聘專員", email: "jing@example.com", phone: "0978-901-234", joinDate: "2021-06-25" },
  { id: 8, name: "趙小剛", employeeId: "EMP008", department: "財務部門", position: "財務分析師", email: "gang@example.com", phone: "0989-012-345", joinDate: "2019-09-30" },
];

const departmentOptions = [
  { value: "all", label: "所有部門" },
  { value: "IT部門", label: "IT部門" },
  { value: "人資部門", label: "人資部門" },
  { value: "財務部門", label: "財務部門" },
  { value: "行銷部門", label: "行銷部門" },
  { value: "業務部門", label: "業務部門" },
];

const Employees = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  
  // Filter employees based on search term and department
  const filteredEmployees = employeesData.filter((employee) => {
    const matchesSearch = 
      employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDepartment = 
      selectedDepartment === "all" || 
      employee.department === selectedDepartment;
    
    return matchesSearch && matchesDepartment;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">員工管理</h1>
        <Dialog open={isAddEmployeeOpen} onOpenChange={setIsAddEmployeeOpen}>
          <DialogTrigger asChild>
            <Button className="bg-hrms-accent">
              <Plus className="mr-2 h-4 w-4" /> 新增員工
            </Button>
          </DialogTrigger>
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
                  <Input id="name" placeholder="輸入姓名" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employeeId">員工編號 *</Label>
                  <Input id="employeeId" placeholder="如: EMP001" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="department">部門 *</Label>
                  <Select>
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
                  <Input id="position" placeholder="輸入職位" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">電子郵件 *</Label>
                  <Input id="email" type="email" placeholder="name@example.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">電話號碼</Label>
                  <Input id="phone" placeholder="如: 0912-345-678" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="joinDate">到職日期 *</Label>
                <Input id="joinDate" type="date" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddEmployeeOpen(false)}>
                取消
              </Button>
              <Button onClick={() => setIsAddEmployeeOpen(false)}>
                儲存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filter */}
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
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="department-filter" className="whitespace-nowrap">
                部門篩選:
              </Label>
              <Select
                value={selectedDepartment}
                onValueChange={(value) => setSelectedDepartment(value)}
              >
                <SelectTrigger id="department-filter" className="w-[180px]">
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
          </div>
        </CardContent>
      </Card>

      {/* Employees Table */}
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
                  <TableHead>到職日期</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.length > 0 ? (
                  filteredEmployees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell className="font-medium">{employee.employeeId}</TableCell>
                      <TableCell>{employee.name}</TableCell>
                      <TableCell>{employee.department}</TableCell>
                      <TableCell>{employee.position}</TableCell>
                      <TableCell>{employee.email}</TableCell>
                      <TableCell>{employee.joinDate}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon">
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon">
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
    </div>
  );
};

export default Employees;
