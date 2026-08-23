"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { apiClient } from "@/lib/api";

export type UserType = "STUDENT" | "TEACHER" | "AUTHORITY" | "REPRESENTATIVE";

export interface UserProfile {
  id: string;
  userId?: string;
  email: string;
  firstName: string;
  lastName: string;
  userType: UserType;
  institutionalCode?: string;
  status: string;
  studentProfile?: {
    course?: string;
    tutor?: string;
    representativeId?: string;
  };
  teacherProfile?: {
    department?: string;
  };
  authorityProfile?: Record<string, unknown>;
  representativeProfile?: {
    phoneNumber?: string;
    identificationNumber?: string;
    students?: Array<{ id: string; firstName: string; lastName: string }>;
  };
  memberships?: Array<{
    id: string;
    role: string;
    organization: {
      id: string;
      name: string;
      code: string;
    };
  }>;
}

export interface RegisterInstitutionalData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  institutionalCode?: string;
  course?: string;
  tutor?: string;
  token?: string;
}

export interface RegisterRepresentativeData {
  token: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  identificationNumber?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<UserProfile>;
  registerInstitutional: (data: RegisterInstitutionalData) => Promise<UserProfile>;
  registerRepresentative: (data: RegisterRepresentativeData) => Promise<UserProfile>;
  recoverPassword: (email: string) => Promise<string>;
  resetPassword: (token: string, newPassword: string) => Promise<string>;
  verifyInvitationToken: (
    token: string
  ) => Promise<{ valid: boolean; type: string; metadata?: Record<string, unknown> }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<UserProfile | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize session from localStorage on client mount
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem("surcos_access_token");
      const storedUser = localStorage.getItem("surcos_user");

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch {
      localStorage.removeItem("surcos_access_token");
      localStorage.removeItem("surcos_user");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveSession = (accessToken: string, refreshToken: string, userData: UserProfile) => {
    localStorage.setItem("surcos_access_token", accessToken);
    localStorage.setItem("surcos_refresh_token", refreshToken);
    localStorage.setItem("surcos_user", JSON.stringify(userData));
    setToken(accessToken);
    setUser(userData);
  };

  const clearSession = () => {
    localStorage.removeItem("surcos_access_token");
    localStorage.removeItem("surcos_refresh_token");
    localStorage.removeItem("surcos_user");
    setToken(null);
    setUser(null);
  };

  const login = async (email: string, password: string): Promise<UserProfile> => {
    const res = await apiClient<{
      statusCode: number;
      message: string;
      data: {
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
        user: UserProfile;
      };
    }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    const { accessToken, refreshToken, user: userData } = res.data;
    saveSession(accessToken, refreshToken, userData);
    return userData;
  };

  const registerInstitutional = async (
    data: RegisterInstitutionalData
  ): Promise<UserProfile> => {
    const res = await apiClient<{
      statusCode: number;
      message: string;
      data: {
        user: UserProfile;
      };
    }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });

    return res.data.user;
  };

  const registerRepresentative = async (
    data: RegisterRepresentativeData
  ): Promise<UserProfile> => {
    const res = await apiClient<{
      statusCode: number;
      message: string;
      data: {
        user: UserProfile;
      };
    }>("/auth/register-representative", {
      method: "POST",
      body: JSON.stringify(data),
    });

    return res.data.user;
  };

  const recoverPassword = async (email: string): Promise<string> => {
    const res = await apiClient<{
      statusCode: number;
      message: string;
    }>("/auth/recover-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });

    return res.message;
  };

  const resetPassword = async (token: string, newPassword: string): Promise<string> => {
    const res = await apiClient<{
      statusCode: number;
      message: string;
    }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, newPassword }),
    });

    return res.message;
  };

  const verifyInvitationToken = async (
    token: string
  ): Promise<{ valid: boolean; type: string; metadata?: Record<string, unknown> }> => {
    const res = await apiClient<{
      statusCode: number;
      valid: boolean;
      type: string;
      metadata?: Record<string, unknown>;
    }>("/auth/tokens/verify", {
      method: "POST",
      body: JSON.stringify({ token }),
    });

    return {
      valid: res.valid,
      type: res.type,
      metadata: res.metadata,
    };
  };

  const logout = useCallback(async () => {
    try {
      if (token) {
        await apiClient("/auth/logout", {
          method: "POST",
        }).catch(() => {});
      }
    } finally {
      clearSession();
    }
  }, [token]);

  const refreshProfile = async (): Promise<UserProfile | null> => {
    try {
      const res = await apiClient<{
        statusCode: number;
        data: UserProfile;
      }>("/auth/me", {
        method: "GET",
      });
      setUser(res.data);
      localStorage.setItem("surcos_user", JSON.stringify(res.data));
      return res.data;
    } catch {
      return null;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        login,
        registerInstitutional,
        registerRepresentative,
        recoverPassword,
        resetPassword,
        verifyInvitationToken,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
