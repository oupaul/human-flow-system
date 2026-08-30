import { LeaveImportResult } from "@/types/leaveImport";
import { apiFetch } from "@/lib/apiClient";

export const leaveImportApi = {
  async importLeaves(file: File): Promise<LeaveImportResult> {
    const formData = new FormData();
    formData.append("file", file);
    return apiFetch<LeaveImportResult>("/leaves/import", {
      method: "POST",
      body: formData,
    });
  },
};
