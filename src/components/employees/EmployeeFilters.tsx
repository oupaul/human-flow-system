
import { 
  Card, 
  CardContent 
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Search, Filter } from "lucide-react";
import { departmentOptions, statusOptions } from "@/types/employee";

interface EmployeeFiltersProps {
  searchTerm: string;
  selectedDepartment: string;
  selectedStatus: string;
  onSearchChange: (value: string) => void;
  onDepartmentChange: (value: string) => void;
  onStatusChange: (value: string) => void;
}

const EmployeeFilters = ({
  searchTerm,
  selectedDepartment,
  selectedStatus,
  onSearchChange,
  onDepartmentChange,
  onStatusChange
}: EmployeeFiltersProps) => {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜尋員工姓名、編號或電子郵件"
              className="pl-8"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
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
                onValueChange={onDepartmentChange}
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
                onValueChange={onStatusChange}
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
  );
};

export default EmployeeFilters;
