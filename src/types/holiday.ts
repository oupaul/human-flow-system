export interface Holiday {
  id: number;
  date: string;
  name: string | null;
  isHoliday: boolean;
  source: "manual" | "dgpa" | "taipei";
  created_at?: string;
}
