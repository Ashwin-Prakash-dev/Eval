import type { User } from "./auth";

export type JudgeOut = User;

export interface JudgeCreate {
  username: string;
  password: string;
  full_name?: string | null;
}

export interface JudgeUpdate {
  full_name?: string | null;
  is_active?: boolean | null;
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
