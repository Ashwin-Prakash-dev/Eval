import type { EvaluationStatus } from "./common";
import type { SubmissionJudgeOut } from "./submission";

export interface ScoreEntry {
  criterion_id: number;
  score: number | null;
  comment?: string | null;
}

export interface EvaluationAutosaveRequest {
  scores: ScoreEntry[];
  overall_comment?: string | null;
  time_spent_delta_seconds?: number;
  mark_complete?: boolean | null;
}

export interface CriterionBrief {
  id: number;
  name: string;
  description: string;
  weight: number;
  order_index: number;
}

export interface ScoreOut {
  criterion_id: number;
  score: number | null;
  comment: string | null;
}

export interface EvaluationOut {
  id: number;
  submission_id: string;
  status: EvaluationStatus;
  weighted_overall_score: number | null;
  time_spent_seconds: number;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
  /** This judge's private bookmark. Never present on another judge's or an admin's view. */
  flagged_for_review: boolean;
  overall_comment: string | null;
  scores: ScoreOut[];
}

export interface EvaluationDetailOut {
  evaluation: EvaluationOut;
  submission: SubmissionJudgeOut;
  criteria: CriterionBrief[];
  counted_reviews: number;
  scoring_limit: number;
  /** False once five other judges have completed this submission first. */
  counts_toward_score: boolean;
}

/** One row of the judge's reviewable list: every submission, with their own state attached. */
export interface ReviewableOut {
  submission: SubmissionJudgeOut;
  evaluation: EvaluationOut | null;
  counted_reviews: number;
  scoring_limit: number;
  criteria: CriterionBrief[];
}

export interface EvaluationJudgeBrief {
  id: number;
  email: string;
  full_name: string | null;
}

/**
 * The admin view. Deliberately does NOT extend EvaluationOut: flagged_for_review is private
 * to the judge and the server never sends it here, so the type must not claim otherwise.
 */
export interface EvaluationAdminOut {
  id: number;
  submission_id: string;
  status: EvaluationStatus;
  weighted_overall_score: number | null;
  time_spent_seconds: number;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
  /** Whether this review is one of the first five completed, i.e. whether it moved the score. */
  counts_toward_score: boolean;
  overall_comment: string | null;
  scores: ScoreOut[];
  judge: EvaluationJudgeBrief;
}

export interface JudgeProgressOut {
  /** Every submission in the event, not an allocation. */
  total_assigned: number;
  completed: number;
  in_progress: number;
  not_started: number;
  percent_complete: number;
  flagged: number;
}
