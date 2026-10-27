export interface Organization {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
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
