"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

const BASE = process.env.NEXT_PUBLIC_API_URL!;

type User = {
  id: number;
  email: string;
  full_name: string;
  role: string;
};

type AuthResult = { ok: boolean; error?: string; user?: User };
type AuthContextType = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (fullName: string, email: string, password: string) => Promise<AuthResult>;
  logout: () => void;
  isAdmin: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore token from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem("auth_token");
    const storedUser = localStorage.getItem("auth_user");
    if (storedToken) {
      setToken(storedToken);
      if (storedUser) {
        setUser(JSON.parse(storedUser));
        setLoading(false);
      } else {
        // Verify token by fetching /auth/me
        fetch(`${BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        })
          .then((res) => {
            if (!res.ok) throw new Error("Token invalid");
            return res.json();
          })
          .then((data) => {
            localStorage.setItem("auth_user", JSON.stringify(data));
            setUser(data);
          })
          .catch(() => {
            localStorage.removeItem("auth_token");
            localStorage.removeItem("auth_user");
            setToken(null);
          })
          .finally(() => setLoading(false));
      }
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await fetch(`${BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data.detail || "Login failed" };
      }
      localStorage.setItem("auth_token", data.access_token);
      localStorage.setItem("auth_user", JSON.stringify(data.user));
      setToken(data.access_token);
      setUser(data.user);
      return { ok: true, user: data.user };
    } catch (e: any) {
      return { ok: false, error: e.message || "Network error" };
    }
  }, []);

  const register = useCallback(async (fullName: string, email: string, password: string) => {
    try {
      const res = await fetch(`${BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Handle Pydantic v2 validation errors: detail can be an array of objects
        let msg = "Registration failed";
        if (Array.isArray(data.detail)) {
          msg = data.detail.map((d: any) => d.msg).join("; ");
        } else if (typeof data.detail === "string") {
          msg = data.detail;
        }
        return { ok: false, error: msg };
      }
      localStorage.setItem("auth_token", data.access_token);
      localStorage.setItem("auth_user", JSON.stringify(data.user));
      setToken(data.access_token);
      setUser(data.user);
      return { ok: true, user: data.user };
    } catch (e: any) {
      return { ok: false, error: e.message || "Network error" };
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    setToken(null);
    setUser(null);
  }, []);

  const isAdmin = user?.role === "admin";

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
