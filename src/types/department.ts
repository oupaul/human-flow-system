
import * as z from "zod";

// 部門表單驗證結構
export const departmentFormSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1, { message: "部門名稱不能為空" }),
  leadName: z.string().min(1, { message: "部門主管不能為空" }),
  parentId: z.number().optional(),
  description: z.string().optional(),
});

export type DepartmentFormData = z.infer<typeof departmentFormSchema>;

// 部門資料結構
export interface Department {
  id: number;
  name: string;
  leadName: string;
  parentId?: number;
  employeeCount: number;
  description: string;
  parentName?: string;
}

export interface ParentDepartmentOption {
  id: number;
  name: string;
}
