import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { authApi, AuthUser } from "@/services/authApi";
import { getToken } from "@/lib/apiClient";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<AuthUser>;
  completeSsoLogin: (token: string) => Promise<AuthUser | null>;
  logout: () => void;
  markPasswordChanged: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    (async () => {
      if (!getToken()) {
        setIsLoading(false);
        return;
      }
      const currentUser = await authApi.getCurrentUser();
      if (active) {
        setUser(currentUser);
        setIsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const login = async (username: string, password: string) => {
    const loggedInUser = await authApi.login(username, password);
    setUser(loggedInUser);
    return loggedInUser;
  };

  const completeSsoLogin = async (token: string) => {
    const loggedInUser = await authApi.completeSsoLogin(token);
    setUser(loggedInUser);
    return loggedInUser;
  };

  const logout = () => {
    authApi.logout();
    setUser(null);
  };

  // 改密碼成功後解除「必須改密碼」狀態（token 已由 authApi.changePassword 換新）
  const markPasswordChanged = () => setUser((prev) => (prev ? { ...prev, mustChangePassword: false } : prev));

  return (
    <AuthContext.Provider value={{ user, isLoading, login, completeSsoLogin, logout, markPasswordChanged }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
