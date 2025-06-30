
import { Department } from "@/types/department";

export const initialDepartmentsData: Department[] = [
  {
    id: 1,
    name: "技術部門",
    leadName: "張志明",
    employeeCount: 3,
    description: "負責軟體開發、系統維護和技術支援",
  },
  {
    id: 2,
    name: "人資部門", 
    leadName: "李美玲",
    employeeCount: 1,
    description: "負責招聘、培訓、薪酬福利和員工關係管理",
  },
  {
    id: 3,
    name: "財務部門",
    leadName: "王大明",
    employeeCount: 1,
    description: "負責財務規劃、會計處理和成本控制",
  },
  {
    id: 4,
    name: "行銷部門",
    leadName: "陳小華",
    employeeCount: 2,
    description: "負責市場推廣、品牌建立和客戶關係管理",
  },
  {
    id: 5,
    name: "業務部門",
    leadName: "林志強",
    employeeCount: 1,
    description: "負責業務拓展、客戶服務和銷售管理",
  },
  {
    id: 6,
    name: "技術支援組",
    leadName: "劉小明",
    parentId: 1,
    parentName: "技術部門",
    employeeCount: 0,
    description: "提供技術支援和系統維護服務",
  },
  {
    id: 7,
    name: "開發組",
    leadName: "黃志華",
    parentId: 1,
    parentName: "技術部門", 
    employeeCount: 0,
    description: "負責軟體產品開發和程式設計",
  },
];
