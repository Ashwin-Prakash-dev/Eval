export interface AssignmentSubmissionBrief {
  id: number;
  project_title: string;
  team_identifier: string;
}

export interface AssignmentJudgeBrief {
  id: number;
  email: string;
  full_name: string | null;
}

export interface AssignmentOut {
  id: number;
  submission: AssignmentSubmissionBrief;
  judge: AssignmentJudgeBrief;
  source: "auto" | "manual";
  assigned_at: string;
  evaluation_status: string;
}

export interface GenerateAssignmentsRequest {
  judges_per_submission: number;
  reset_existing: boolean;
}

export interface GenerateAssignmentsResult {
  assignments_created: number;
  submissions_covered: number;
  judges_used: number;
  min_load: number;
  max_load: number;
  warnings: string[];
}

export interface ManualAssignmentCreate {
  submission_id: number;
  judge_id: number;
}

export interface ConflictExclusionCreate {
  submission_id: number;
  judge_id: number;
  reason?: string | null;
}

export interface ConflictExclusionOut {
  id: number;
  submission_id: number;
  judge_id: number;
  reason: string | null;
  created_at: string;
}
