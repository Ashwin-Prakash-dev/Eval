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
  assignment_id: number;
  submission_id: number;
  status: EvaluationStatus;
  weighted_overall_score: number | null;
  time_spent_seconds: number;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
  overall_comment: string | null;
  scores: ScoreOut[];
}

export interface EvaluationDetailOut {
  evaluation: EvaluationOut;
  submission: SubmissionJudgeOut;
  criteria: CriterionBrief[];
}

export interface EvaluationJudgeBrief {
  id: number;
  email: string;
  full_name: string | null;
}

export interface EvaluationAdminOut extends EvaluationOut {
  judge: EvaluationJudgeBrief;
}

export interface JudgeProgressOut {
  total_assigned: number;
  completed: number;
  in_progress: number;
  not_started: number;
  percent_complete: number;
}
