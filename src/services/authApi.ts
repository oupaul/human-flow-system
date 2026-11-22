import { apiFetch, setToken, clearToken, getToken } from "@/lib/apiClient";

export const STAFF_ROLES = ["admin", "hr", "manager"] as const;

export interface AuthUser {
  id: number;
  username: string;
  role: string;
  employeeId: string | null;
  employeeName: string | null;
  gender: "male" | "female" | null;
  mustChangePassword?: boolean;
}

// 只有 admin/hr 能看到與修改薪資、折現金額（後端同樣限制，這裡只是避免畫面出現空欄位或誤導文字）
export function canViewSalary(role: string | undefined): boolean {
  return role === "admin" || role === "hr";
}

export function isStaffRole(role: string): boolean {
  return (STAFF_ROLES as readonly string[]).includes(role);
}

interface LoginResponse {
  token: string;
  user: AuthUser;
}

// 後端會重導到這個路徑開始 Microsoft 登入流程，未跨路由所以用相對路徑，
// 瀏覽器整頁導航即可（不透過 apiFetch，因為要讓瀏覽器實際跳轉到 Microsoft 登入頁）
export const MICROSOFT_LOGIN_URL = "/api/auth/microsoft/login";

export const authApi = {
  async login(username: string, password: string): Promise<AuthUser> {
    const result = await apiFetch<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    setToken(result.token);
    return result.user;
  },

  async getMicrosoftSsoStatus(): Promise<{ enabled: boolean }> {
    try {
      return await apiFetch<{ enabled: boolean }>("/auth/microsoft/status");
    } catch {
      return { enabled: false };
    }
  },

  // 供 Microsoft SSO 登入完成後的 /sso-callback 頁面使用：後端已核發 token，
  // 這裡只需要存起來並補齊完整使用者資料，流程等同一般登入的最後一步
  async completeSsoLogin(token: string): Promise<AuthUser | null> {
    setToken(token);
    return this.getCurrentUser();
  },

  async getCurrentUser(): Promise<AuthUser | null> {
    if (!getToken()) {
      return null;
    }
    try {
      const result = await apiFetch<{ user: AuthUser }>("/auth/me");
      return result.user;
    } catch {
      return null;
    }
  },

  logout(): void {
    clearToken();
  },

  // 改密碼成功後後端會核發新的 token（不再帶「必須改密碼」標記），要換掉舊的
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const result = await apiFetch<{ message: string; token?: string }>("/auth/change-password", {
      method: "PUT",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (result.token) setToken(result.token);
  },
};
