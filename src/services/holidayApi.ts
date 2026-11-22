import { Holiday } from "@/types/holiday";
import { apiFetch } from "@/lib/apiClient";

export const holidayApi = {
  async getHolidays(year?: number): Promise<Holiday[]> {
    const query = year ? `?year=${year}` : "";
    return apiFetch<Holiday[]>(`/holidays${query}`);
  },

  async createHoliday(data: { date: string; name?: string; isHoliday: boolean }): Promise<Holiday> {
    return apiFetch<Holiday>("/holidays", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async importHolidays(csv: string): Promise<{ message: string; imported: number }> {
    return apiFetch<{ message: string; imported: number }>("/holidays/import", {
      method: "POST",
      body: JSON.stringify({ csv }),
    });
  },

  async syncHolidays(): Promise<{ message: string; imported: number; years: string[] }> {
    return apiFetch<{ message: string; imported: number; years: string[] }>("/holidays/sync", {
      method: "POST",
    });
  },

  async deleteHoliday(id: number): Promise<void> {
    await apiFetch<void>(`/holidays/${id}`, {
      method: "DELETE",
    });
  },
};
