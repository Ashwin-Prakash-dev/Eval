import type { User } from "./auth";
import type { UserRole } from "./common";

export type JudgeOut = User;

export interface JudgeUpdate {
  full_name?: string | null;
  is_active?: boolean | null;
}

export interface AllowedEmailCreate {
  email: string;
  role?: UserRole;
  full_name?: string | null;
  note?: string | null;
}

export interface AllowedEmailUpdate {
  full_name?: string | null;
  note?: string | null;
  is_active?: boolean | null;
}

export interface AllowedEmailOut {
  id: number;
  email: string;
  role: UserRole;
  full_name: string | null;
  note: string | null;
  is_active: boolean;
  created_at: string;
  user: JudgeOut | null;
}

export interface AllowedEmailBulkResult {
  created: number;
  skipped: number;
  skipped_emails: string[];
}

export interface JudgeStats {
  judge: JudgeOut;
  reviews_assigned: number;
  reviews_completed: number;
  reviews_pending: number;
  average_score_given: number | null;
  std_dev_given: number | null;
  average_review_time_seconds: number | null;
  is_harsh: boolean;
  is_lenient: boolean;
  is_high_variance: boolean;
}
