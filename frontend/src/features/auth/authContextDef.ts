import { createContext } from "react";
import type { LoginPayload, MembershipSummary, RegisterPayload, User } from "../../types/auth";

export interface AuthContextType {
  user: User | null;
  memberships: MembershipSummary[];
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
