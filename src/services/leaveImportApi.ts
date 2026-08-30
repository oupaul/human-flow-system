import { LeaveImportResult } from "@/types/leaveImport";
import { apiFetch, apiFetchBlob } from "@/lib/apiClient";

export const leaveImportApi = {
  async downloadImportTemplate(): Promise<Blob> {
    return apiFetchBlob("/leaves/import-template");
  },

  async importLeaves(file: File): Promise<LeaveImportResult> {
    const formData = new FormData();
    formData.append("file", file);
    return apiFetch<LeaveImportResult>("/leaves/import", {
      method: "POST",
      body: formData,
    });
  },
};
