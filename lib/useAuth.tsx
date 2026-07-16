'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from 'react';
import { User, getCurrentUser } from './auth-service';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string) => Promise<User | null>;
  logout: () => void;
  updateUser: (user: User) => void;
  refreshUser: (tokenOverride?: string) => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const persist = useCallback((t: string | null, u: User | null) => {
    if (t) localStorage.setItem('token', t);
    else localStorage.removeItem('token');

    if (u) localStorage.setItem('user', JSON.stringify(u));
    else localStorage.removeItem('user');
  }, []);

  const refreshUser = useCallback(async (tokenOverride?: string): Promise<User | null> => {
    const t = tokenOverride || localStorage.getItem('token');
    if (!t) {
      setToken(null);
      setUser(null);
      persist(null, null);
      return null;
    }

    localStorage.setItem('token', t);

    try {
      const fresh = await getCurrentUser();
      setUser(fresh);
      setToken(t);
      persist(t, fresh);
      return fresh;
    } catch (e) {
      console.error('refreshUser failed:', e);
      setToken(null);
      setUser(null);
      persist(null, null);
      localStorage.removeItem('rememberedEmail');
      return null;
    }
  }, [persist]);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    localStorage.removeItem('user');

    if (storedToken) {
      refreshUser(storedToken).finally(() => setIsLoading(false));
      return;
    }

    Promise.resolve().then(() => setIsLoading(false));
  }, [refreshUser]);

  const login = useCallback(async (newToken: string): Promise<User | null> => {
    setIsLoading(true);
    setToken(newToken);
    setUser(null);
    persist(newToken, null);

    try {
      return await refreshUser(newToken);
    } finally {
      setIsLoading(false);
    }
  }, [persist, refreshUser]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    persist(null, null);
    localStorage.removeItem('rememberedEmail');
  }, [persist]);

  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser);
    persist(token, updatedUser);
  }, [persist, token]);

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!token && !!user,
    isLoading,
    login,
    logout,
    updateUser,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
