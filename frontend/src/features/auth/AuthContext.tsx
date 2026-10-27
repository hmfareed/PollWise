import React, { useEffect, useState } from "react";
import { apiClient } from "../../lib/api-client";
import type { LoginPayload, MembershipSummary, RegisterPayload, User } from "../../types/auth";
import { AuthContext } from "./authContextDef";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [memberships, setMemberships] = useState<MembershipSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = async () => {
    try {
      const data = await apiClient.getMe();
      setUser(data.user);
      setMemberships(data.memberships);
    } catch {
      setUser(null);
      setMemberships([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    apiClient
      .getMe()
      .then((data) => {
        if (isMounted) {
          setUser(data.user);
          setMemberships(data.memberships);
        }
      })
      .catch(() => {
        if (isMounted) {
          setUser(null);
          setMemberships([]);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (payload: LoginPayload) => {
    const data = await apiClient.login(payload);
    setUser(data.user);
    setMemberships(data.memberships);
  };

  const register = async (payload: RegisterPayload) => {
    await apiClient.register(payload);
    await login({ email: payload.email, password: payload.password });
  };

  const logout = async () => {
    try {
      await apiClient.logout();
    } finally {
      setUser(null);
      setMemberships([]);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        memberships,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
