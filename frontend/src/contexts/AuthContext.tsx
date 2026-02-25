import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, AuthState, UserRole } from '@/types';
import { authApi, isRemoteMode } from '@/lib/api';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string, role: UserRole) => Promise<boolean>;
  logout: () => void;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_KEY = 'swimtrack_auth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
  });

  useEffect(() => {
    // Check for existing session
    const savedAuth = localStorage.getItem(AUTH_KEY);
    if (savedAuth) {
      try {
        const parsed = JSON.parse(savedAuth);
        setAuthState(parsed);
      } catch {
        localStorage.removeItem(AUTH_KEY);
      }
    }
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const result = await authApi.login(email, password);
      
      if (result.success && result.user) {
        const newAuthState = { isAuthenticated: true, user: result.user };
        setAuthState(newAuthState);
        localStorage.setItem(AUTH_KEY, JSON.stringify(newAuthState));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      if (isRemoteMode()) {
        throw error; // Re-throw in remote mode to show API error
      }
      return false;
    }
  };

  const register = async (email: string, password: string, name: string, role: UserRole): Promise<boolean> => {
    try {
      const result = await authApi.register(email, password, name, role);
      
      if (result.success && result.user) {
        const newAuthState = { isAuthenticated: true, user: result.user };
        setAuthState(newAuthState);
        localStorage.setItem(AUTH_KEY, JSON.stringify(newAuthState));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Registration error:', error);
      if (isRemoteMode()) {
        throw error; // Re-throw in remote mode to show API error
      }
      return false;
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
    setAuthState({ isAuthenticated: false, user: null });
    localStorage.removeItem(AUTH_KEY);
  };

  const updateUser = async (user: User) => {
    try {
      await authApi.saveUser(user);
      const newAuthState = { isAuthenticated: true, user };
      setAuthState(newAuthState);
      localStorage.setItem(AUTH_KEY, JSON.stringify(newAuthState));
    } catch (error) {
      console.error('Update user error:', error);
      if (isRemoteMode()) {
        throw error;
      }
    }
  };

  return (
    <AuthContext.Provider value={{ ...authState, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
