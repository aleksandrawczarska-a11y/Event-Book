export type ModerationStatus = "pending" | "approved" | "rejected";

export interface DecoratorProfile {
  id: string;
  user_id: string;
  company_name: string;
  profile_photo_url: string | null;
  description: string | null;
  city: string;
  instagram_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  event_types: string[];
  decoration_styles: string[];
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface PortfolioEntry {
  id: string;
  decorator_profile_id: string;
  storage_path: string;
  event_description: string | null;
  decoration_style: string | null;
  location: string | null;
  tags: string[];
  moderation_status: ModerationStatus;
  created_at: string;
}

export interface ContactInquiry {
  id: string;
  decorator_profile_id: string;
  client_name: string;
  client_email: string;
  client_phone: string | null;
  event_date: string;
  needs_description: string;
  created_at: string;
}

export interface CreateProfileInput {
  company_name: string;
  profile_photo_url?: string | null;
  description?: string | null;
  city: string;
  instagram_url?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  event_types?: string[];
  decoration_styles?: string[];
  is_published?: boolean;
}

export type UpdateProfileInput = Partial<CreateProfileInput>;

export interface CreatePortfolioEntryInput {
  storage_path: string;
  event_description?: string | null;
  decoration_style?: string | null;
  location?: string | null;
  tags?: string[];
}

export interface CreateContactInquiryInput {
  decorator_profile_id: string;
  client_name: string;
  client_email: string;
  client_phone?: string | null;
  event_date: string;
  needs_description: string;
}

export interface DashboardProfileSummary {
  id: string;
  company_name: string;
  is_published: boolean;
}
