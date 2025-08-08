import React, { createContext, useContext, useState, useEffect } from "react";
import { registerForPushNotificationsAsync } from "../services/notifications";

type User = {
  id: string;
  email: string;
};

type AuthContextType = {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    registerForPushNotificationsAsync();
  }, []);

  async function login(email: string, password: string) {
    if (!email || !password) {
      throw new Error("Missing credentials");
    }
    setUser({ id: "1", email });
  }

  async function register(email: string, password: string) {
    await login(email, password);
  }

  function logout() {
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
