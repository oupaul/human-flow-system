
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface DepartmentFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

const DepartmentFilters = ({ searchTerm, onSearchChange }: DepartmentFiltersProps) => {
  return (
    <div className="relative max-w-md">
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
      <Input
        type="search"
        placeholder="搜尋部門或主管..."
        className="pl-9"
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      {searchTerm && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-0 top-0 h-10 w-10 text-gray-500"
          onClick={() => onSearchChange("")}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};

export default DepartmentFilters;
