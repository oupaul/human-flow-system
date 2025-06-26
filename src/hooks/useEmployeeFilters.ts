
import { useState, useMemo } from "react";
import { employeesData } from "@/types/employee";

export const useEmployeeFilters = (employees: typeof employeesData) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  const filteredEmployees = useMemo(() => {
    return employees.filter((employee) => {
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
  }, [employees, searchTerm, selectedDepartment, selectedStatus]);

  return {
    searchTerm,
    setSearchTerm,
    selectedDepartment,
    setSelectedDepartment,
    selectedStatus,
    setSelectedStatus,
    filteredEmployees,
  };
};
