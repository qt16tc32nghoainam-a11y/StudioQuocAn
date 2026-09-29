import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from './api';

export type Role = 'Admin' | 'NhanVien';
export interface User {
  id: string;
  full_name: string;
  username: string;
  email: string;
  phone?: string;
  role: Role;
}

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
}

const Ctx = createContext<AuthCtx>(null as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener('wa-unauthorized', onUnauthorized);
    return () => window.removeEventListener('wa-unauthorized', onUnauthorized);
  }, []);

  useEffect(() => {
    if (!getToken()) { setLoading(false); return; }
    api.get<User>('/auth/me')
      .then((u) => setUser(u))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (username: string, password: string) => {
    const res = await api.post<{ token: string; user: User }>('/auth/login', { username, password });
    setToken(res.token);
    setUser(res.user);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, loading, login, logout, isAdmin: user?.role === 'Admin' }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
