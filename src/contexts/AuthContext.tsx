import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { authApi, AuthUser } from "@/services/authApi";
import { getToken } from "@/lib/apiClient";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
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
  };

  const logout = () => {
    authApi.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
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
