
import { Department } from "@/types/department";

export const initialDepartmentsData: Department[] = [
  {
    id: 1,
    name: "IT部門",
    leadName: "陳志明",
    employeeCount: 15,
    description: "負責公司所有IT系統的開發和維護，包括內部系統和客戶產品。",
  },
  {
    id: 2,
    name: "人資部門",
    leadName: "王美玲",
    employeeCount: 8,
    description: "負責員工招聘、培訓、績效評估以及所有人力資源相關事務。",
  },
  {
    id: 3,
    name: "財務部門",
    leadName: "林大偉",
    employeeCount: 10,
    description: "負責公司財務規劃、會計、稅務申報和財務報告。",
  },
  {
    id: 4,
    name: "行銷部門",
    leadName: "李小芬",
    employeeCount: 12,
    description: "負責品牌建設、市場策略、產品推廣和社交媒體管理。",
  },
  {
    id: 5,
    name: "業務部門",
    leadName: "張俊傑",
    employeeCount: 18,
    description: "負責客戶開發、關係維護、銷售和商務談判。",
  },
  {
    id: 6,
    name: "研發團隊",
    leadName: "黃建國",
    parentId: 1,
    parentName: "IT部門",
    employeeCount: 8,
    description: "專注於新產品和技術的研發工作。",
  },
  {
    id: 7,
    name: "系統維護團隊",
    leadName: "劉小華",
    parentId: 1,
    parentName: "IT部門",
    employeeCount: 7,
    description: "負責系統維護和技術支援。",
  },
];
