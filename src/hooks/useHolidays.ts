import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Holiday } from "@/types/holiday";
import { holidayApi } from "@/services/holidayApi";

export const useHolidays = (year: number) => {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHolidays = useCallback(async () => {
    try {
      setLoading(true);
      const data = await holidayApi.getHolidays(year);
      setHolidays(data);
    } catch (error) {
      console.error("Failed to load holidays:", error);
      toast.error("載入國定假日失敗", {
        description: "請檢查網路連線或聯繫系統管理員",
      });
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    loadHolidays();
  }, [loadHolidays]);

  const importHolidays = async (csv: string) => {
    try {
      const result = await holidayApi.importHolidays(csv);
      await loadHolidays();
      toast.success("匯入成功", {
        description: `已匯入 ${result.imported} 筆假日資料`,
      });
    } catch (error) {
      console.error("Failed to import holidays:", error);
      toast.error("匯入國定假日失敗", {
        description: error instanceof Error ? error.message : "請確認 CSV 格式是否正確",
      });
    }
  };

  const createHoliday = async (data: { date: string; name?: string; isHoliday: boolean }) => {
    try {
      await holidayApi.createHoliday(data);
      await loadHolidays();
      toast.success("假日新增成功");
    } catch (error) {
      console.error("Failed to create holiday:", error);
      toast.error("新增假日失敗", {
        description: "請檢查網路連線或聯繫系統管理員",
      });
    }
  };

  const deleteHoliday = async (id: number) => {
    try {
      await holidayApi.deleteHoliday(id);
      await loadHolidays();
      toast.success("假日已刪除");
    } catch (error) {
      console.error("Failed to delete holiday:", error);
      toast.error("刪除假日失敗", {
        description: "請檢查網路連線或聯繫系統管理員",
      });
    }
  };

  return {
    holidays,
    loading,
    importHolidays,
    createHoliday,
    deleteHoliday,
    reload: loadHolidays,
  };
};
