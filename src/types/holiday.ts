export interface Holiday {
  id: number;
  date: string;
  name: string | null;
  isHoliday: boolean;
  source: "manual" | "dgpa";
  created_at?: string;
}
