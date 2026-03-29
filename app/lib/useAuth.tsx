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
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (user: User) => void;
  refreshUser: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const persist = (t: string | null, u: User | null) => {
    if (t) localStorage.setItem('token', t);
    else localStorage.removeItem('token');

    if (u) localStorage.setItem('user', JSON.stringify(u));
    else localStorage.removeItem('user');
  };

  const refreshUser = useCallback(async (): Promise<User | null> => {
    const t = localStorage.getItem('token');
    if (!t) return null;

    try {
      const fresh = await getCurrentUser(); // ✅ MUST MATCH backend shape
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
  }, []);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (storedToken) {
      setToken(storedToken);

      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch (error) {
          console.error('Failed to parse stored user data:', error);
          localStorage.removeItem('user');
        }
      }

      refreshUser().finally(() => setIsLoading(false));
      return;
    }

    setIsLoading(false);
  }, [refreshUser]);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    persist(newToken, newUser);

    // ✅ server-truth refresh (addresses/default/sub coverage)
    refreshUser().catch(() => {});
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    persist(null, null);
    localStorage.removeItem('rememberedEmail');
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
    persist(token, updatedUser);
  };

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
