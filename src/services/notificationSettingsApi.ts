import { NotificationSettings, NotificationSettingsFormData } from "@/types/notificationSettings";
import { apiFetch } from "@/lib/apiClient";

export const notificationSettingsApi = {
  async getSettings(): Promise<NotificationSettings> {
    return apiFetch<NotificationSettings>("/settings/notifications");
  },

  async updateSettings(data: NotificationSettingsFormData): Promise<{ message: string }> {
    return apiFetch<{ message: string }>("/settings/notifications", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async sendTest(): Promise<{ message: string }> {
    return apiFetch<{ message: string }>("/settings/notifications/test", {
      method: "POST",
    });
  },
};
