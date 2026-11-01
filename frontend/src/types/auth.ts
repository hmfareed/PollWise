export interface User {
  id: string;
  email: string;
  display_name: string;
  email_verified: boolean;
  account_status: string;
  is_platform_admin: boolean;
  created_at: string;
  first_name?: string | null;
  last_name?: string | null;
  phone_number?: string | null;
  profile_image_url?: string | null;
  country?: string | null;
  preferred_language?: string | null;
  mfa_enabled?: boolean;
  account_type?: "personal" | "institution";
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
  display_name?: string;
  account_type?: "personal" | "institution";
  first_name?: string;
  last_name?: string;
  terms_accepted?: boolean;
  institution_name?: string;
  institution_type?: string;
  country?: string;
}

export interface PersonalRegisterPayload {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  terms_accepted: boolean;
}

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
}

export interface PersonalOnboarding {
  id: string;
  user_id: string;
  onboarding_status: "not_started" | "in_progress" | "completed" | string;
  current_step: number;
  profile_completed_at?: string | null;
  security_setup_completed_at?: string | null;
  institution_step_completed_at?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface UpdatePersonalOnboardingPayload {
  current_step?: number;
  onboarding_status?: "not_started" | "in_progress" | "completed" | string;
}

export interface UpdateUserProfilePayload {
  first_name?: string;
  last_name?: string;
  display_name?: string;
  phone_number?: string;
  profile_image_url?: string;
  country?: string;
  preferred_language?: string;
}

export interface MfaSetupResponse {
  secret: string;
  qr_uri: string;
  recovery_codes: string[];
}

export interface MfaVerifyResponse {
  message: string;
  mfa_enabled: boolean;
}

export interface InvitationValidationResponse {
  invitation_code: string;
  institution_id: string;
  institution_name: string;
  invitation_type: string;
  expires_at?: string | null;
}

export interface AcceptInvitationResponse {
  message: string;
  institution_id?: string;
  institution_name?: string;
  role?: string;
  status?: string;
}

export interface UserElectionSummary {
  id: string;
  title: string;
  status: string;
  start_time?: string | null;
  end_time?: string | null;
  institution_name?: string | null;
  has_voted: boolean;
}
