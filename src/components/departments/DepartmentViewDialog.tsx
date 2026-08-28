
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { Department } from "@/types/department";
import { Employee } from "@/types/employee";

interface DepartmentViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department: Department | null;
  members: Employee[];
  assignableEmployees: Employee[];
  otherDepartments: Department[];
  onMoveEmployee: (employee: Employee, departmentName: string) => void;
}

const DepartmentViewDialog = ({
  open,
  onOpenChange,
  department,
  members,
  assignableEmployees,
  otherDepartments,
  onMoveEmployee,
}: DepartmentViewDialogProps) => {
  const { t } = useTranslation(["departments", "common"]);
  const [addingEmployeeId, setAddingEmployeeId] = useState("");

  if (!department) return null;

  const handleAddMember = () => {
    if (!addingEmployeeId) return;
    const employee = assignableEmployees.find((e) => e.id.toString() === addingEmployeeId);
    if (!employee) return;
    onMoveEmployee(employee, department.name);
    setAddingEmployeeId("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px]">
        <DialogHeader>
          <DialogTitle>{t("departments:view.title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">{department.name}</h3>
            <p className="text-sm text-gray-500">
              {department.parentId ? t("departments:view.subDepartment") : t("departments:view.mainDepartment")}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium">{t("departments:view.leadLabel")}</h4>
              <p>{department.leadName}</p>
            </div>

            {department.parentId && department.parentName && (
              <div>
                <h4 className="text-sm font-medium">{t("departments:view.parentDepartmentLabel")}</h4>
                <p>{department.parentName}</p>
              </div>
            )}

            <div>
              <h4 className="text-sm font-medium">{t("departments:view.employeeCountLabel")}</h4>
              <p>{t("departments:view.employeeCountValue", { count: department.employeeCount })}</p>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium">{t("departments:view.descriptionLabel")}</h4>
            <p className="text-sm text-gray-600">{department.description}</p>
          </div>

          <div className="space-y-2 border-t pt-4">
            <h4 className="text-sm font-medium">{t("departments:members.sectionTitle")}</h4>

            <div className="flex gap-2">
              <Select value={addingEmployeeId} onValueChange={setAddingEmployeeId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={t("departments:members.addPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {assignableEmployees.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      {t("departments:members.noOtherEmployees")}
                    </div>
                  ) : (
                    assignableEmployees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id.toString()}>
                        {t("departments:members.addOptionLabel", {
                          name: employee.name,
                          employeeId: employee.employeeId,
                          department: employee.department,
                        })}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <Button onClick={handleAddMember} disabled={!addingEmployeeId}>
                <UserPlus className="mr-2 h-4 w-4" />
                {t("departments:members.addButton")}
              </Button>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("departments:members.columns.name")}</TableHead>
                    <TableHead>{t("departments:members.columns.employeeId")}</TableHead>
                    <TableHead>{t("departments:members.columns.position")}</TableHead>
                    <TableHead className="text-right">{t("departments:members.columns.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                        {t("departments:members.noMembers")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    members.map((employee) => (
                      <TableRow key={employee.id}>
                        <TableCell>{employee.name}</TableCell>
                        <TableCell>{employee.employeeId}</TableCell>
                        <TableCell>{employee.position}</TableCell>
                        <TableCell className="text-right">
                          <Select
                            value=""
                            onValueChange={(value) => onMoveEmployee(employee, value)}
                          >
                            <SelectTrigger className="ml-auto w-[180px]">
                              <SelectValue placeholder={t("departments:members.moveToPlaceholder")} />
                            </SelectTrigger>
                            <SelectContent>
                              {otherDepartments
                                .filter((d) => d.id !== department.id)
                                .map((d) => (
                                  <SelectItem key={d.id} value={d.name}>
                                    {d.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>{t("common:actions.close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DepartmentViewDialog;
