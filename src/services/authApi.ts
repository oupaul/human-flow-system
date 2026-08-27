import { apiFetch, setToken, clearToken, getToken } from "@/lib/apiClient";

export interface AuthUser {
  id: number;
  username: string;
  role: string;
  employeeId: string | null;
}

interface LoginResponse {
  token: string;
  user: AuthUser;
}

export const authApi = {
  async login(username: string, password: string): Promise<AuthUser> {
    const result = await apiFetch<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    setToken(result.token);
    return result.user;
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
};
