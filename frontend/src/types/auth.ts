export interface User {
  id: string;
  email: string;
  display_name: string;
  email_verified: boolean;
  account_status: string;
  is_platform_admin: boolean;
  created_at: string;
}

export interface MembershipSummary {
  id: string;
  organization_id: string;
  organization_name: string;
  organization_slug: string;
  role: string;
  status: string;
}

export interface MeResponse {
  user: User;
  memberships: MembershipSummary[];
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  display_name: string;
}
