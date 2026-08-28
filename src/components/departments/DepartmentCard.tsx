
import { Users, UserCircle, Edit, Trash } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Department } from "@/types/department";

interface DepartmentCardProps {
  department: Department;
  isSubDepartment?: boolean;
  onView: (department: Department) => void;
  onEdit: (department: Department) => void;
  onDelete: (department: Department) => void;
}

const DepartmentCard = ({ 
  department, 
  isSubDepartment = false, 
  onView, 
  onEdit, 
  onDelete 
}: DepartmentCardProps) => {
  const { t } = useTranslation(["departments", "common"]);

  return (
    <Card className={`overflow-hidden ${isSubDepartment ? 'border-l-4 border-l-hrms-accent' : ''}`}>
      <CardHeader className={`pb-3 ${isSubDepartment ? 'bg-gray-100' : 'bg-hrms-primary text-white'}`}>
        <CardTitle>{department.name}</CardTitle>
        <CardDescription className={`mt-1 ${isSubDepartment ? 'text-gray-600' : 'text-gray-200'}`}>
          <div className="flex items-center">
            <UserCircle className="h-4 w-4 mr-1" />
            {t("departments:shared.lead", { name: department.leadName })}
          </div>
          <div className="flex items-center mt-1">
            <Users className="h-4 w-4 mr-1" />
            {t("departments:shared.employeeCount", { count: department.employeeCount })}
          </div>
          {department.parentId && department.parentName && (
            <div className={`mt-1 ${isSubDepartment ? 'text-xs text-gray-500' : 'text-gray-200'}`}>
              {t("departments:shared.parentDepartment", { name: department.parentName })}
            </div>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <p className="text-sm text-gray-600">{department.description}</p>
      </CardContent>
      <CardFooter className="flex justify-between border-t bg-gray-50 px-6 py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onView(department)}
        >
          <Users className="mr-2 h-4 w-4" />
          {t("departments:card.viewDepartment")}
        </Button>
        <div className="flex gap-2">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => onEdit(department)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => onDelete(department)}
          >
            <Trash className="h-4 w-4 text-hrms-danger" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default DepartmentCard;
