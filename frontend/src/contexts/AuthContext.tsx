import React, { createContext, useContext, useState, ReactNode } from 'react';
import { User, AuthState, UserRole } from '@/types';
import { authApi, isRemoteMode } from '@/lib/api';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string, role: UserRole, language?: string) => Promise<boolean>;
  logout: () => void;
  updateUser: (user: User) => void;
  /** Merge fields into the in-memory user (and localStorage) without
      hitting the API. Used by /change-password to clear forcePasswordChange. */
  patchUser: (patch: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_KEY = 'swimtrack_auth';

export function AuthProvider({ children }: { children: ReactNode }) {
  // Hydrate from localStorage synchronously on first render so that pages
  // reading `isAuthenticated` in their initial useEffect don't incorrectly
  // redirect to /login before a useEffect-based hydration can run.
  const [authState, setAuthState] = useState<AuthState>(() => {
    try {
      const savedAuth = localStorage.getItem(AUTH_KEY);
      if (savedAuth) {
        return JSON.parse(savedAuth) as AuthState;
      }
    } catch {
      localStorage.removeItem(AUTH_KEY);
    }
    return { isAuthenticated: false, user: null };
  });

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

  const register = async (email: string, password: string, name: string, role: UserRole, language?: string): Promise<boolean> => {
    try {
      const result = await authApi.register(email, password, name, role, language);
      
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

  const patchUser = (patch: Partial<User>) => {
    if (!authState.user) return;
    const newUser = { ...authState.user, ...patch };
    const newAuthState = { isAuthenticated: true, user: newUser };
    setAuthState(newAuthState);
    localStorage.setItem(AUTH_KEY, JSON.stringify(newAuthState));
  };

  return (
    <AuthContext.Provider value={{ ...authState, login, register, logout, updateUser, patchUser }}>
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
