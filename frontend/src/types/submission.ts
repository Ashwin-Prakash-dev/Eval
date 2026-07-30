import type { VideoType } from "./common";

export interface ProblemStatement {
  id: number;
  code: string;
  title: string;
  description: string;
  created_at: string;
}

export interface ProblemStatementCreate {
  code: string;
  title: string;
  description?: string;
}

export type ProblemStatementUpdate = Partial<ProblemStatementCreate>;

export interface ProblemStatementBrief {
  id: number;
  code: string;
  title: string;
}

export interface SubmissionCreate {
  project_title: string;
  team_identifier: string;
  problem_statement_id?: number | null;
  short_description?: string;
  additional_notes?: string | null;
  video_type: VideoType;
  video_url?: string | null;
}

export type SubmissionUpdate = Partial<SubmissionCreate>;

export interface SubmissionOut {
  id: number;
  project_title: string;
  team_identifier: string;
  short_description: string;
  additional_notes: string | null;
  problem_statement: ProblemStatementBrief | null;
  has_ppt: boolean;
  has_pdf: boolean;
  video_type: VideoType;
  video_url: string | null;
  has_video_file: boolean;
  created_at: string;
  updated_at: string;
}

export interface SubmissionJudgeOut {
  id: number;
  project_title: string;
  short_description: string;
  additional_notes: string | null;
  problem_statement: ProblemStatementBrief | null;
  has_ppt: boolean;
  has_pdf: boolean;
  video_type: VideoType;
  video_url: string | null;
  has_video_file: boolean;
}

export interface BulkImportResult {
  created: number;
  failed: number;
  errors: string[];
}
