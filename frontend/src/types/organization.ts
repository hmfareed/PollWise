export interface Organization {
  id: string;
  name: string;
  slug: string;
  status: string;
  metadata?: Record<string, any> | null;
  created_at: string;
}

export interface StructureUnit {
  name: string;
  unit_type: string;
}

export interface OrganizationOnboardingPayload {
  institution_name?: string;
  abbreviation?: string;
  institution_type?: string;
  country?: string;
  region?: string;
  city?: string;
  website?: string;
  contact_email?: string;
  contact_phone?: string;
  logo_url?: string;
  description?: string;
  approximate_members?: number;
  department_count?: number;
  registration_identifier?: string;
  admin_title?: string;
  admin_department?: string;
  admin_phone?: string;
  structure_units?: StructureUnit[];
  mfa_policy?: string;
  approved_domains?: string[];
  invitation_permission?: string;
  session_idle_minutes?: number;
  session_absolute_hours?: number;
  require_dual_approval_for_launch?: boolean;
  is_completed?: boolean;
}

export interface MemberDetail {
  id: string;
  user_id: string;
  email: string;
  display_name: string;
  role: string;
  status: string;
  created_at: string;
}

export interface CreateOrganizationPayload {
  name: string;
  slug?: string;
}

export interface AddMemberPayload {
  email: string;
  role: string;
}
