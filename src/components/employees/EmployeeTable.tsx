
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
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { 
  Pencil, 
  FileText, 
  Trash2,
  Badge,
  UserX,
  User,
  Phone,
  Mail,
  Calendar,
  Briefcase
} from "lucide-react";
import { Employee, EmployeeFormData } from "@/types/employee";

interface EmployeeTableProps {
  filteredEmployees: Employee[];
  onViewEmployee: (employee: Employee) => void;
  onEditEmployee: (employee: Employee) => void;
  onDeleteEmployee: (employee: Employee) => void;
  onTerminateEmployee: (employee: Employee) => void;
}

const EmployeeTable = ({
  filteredEmployees,
  onViewEmployee,
  onEditEmployee,
  onDeleteEmployee,
  onTerminateEmployee
}: EmployeeTableProps) => {
  return (
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
                          onClick={() => onViewEmployee(employee)}
                          title="查看詳細資料"
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => onEditEmployee(employee)}
                          title="編輯資料"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {employee.active && (
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => onTerminateEmployee(employee)}
                            title="標記為離職"
                          >
                            <UserX className="h-4 w-4 text-hrms-warning" />
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => onDeleteEmployee(employee)}
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
  );
};

export default EmployeeTable;
