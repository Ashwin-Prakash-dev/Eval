import type { SubmissionWithProblemStatement, VideoType } from "../db";

export interface ProblemStatementBrief {
  id: number;
  code: string;
  title: string;
}

/**
 * Team identity is enforced by type, not by filtering.
 *
 * `SubmissionOut` (admin) carries `team_identifier`; `SubmissionJudgeOut` structurally has
 * no such field, so a judge-facing response physically cannot contain it. Both mappers
 * build their object field by field and never spread a database row — spreading would
 * reintroduce the leak the moment a new column is added. See backend/app/schemas/
 * submission.py, which used two separate Pydantic models for the same reason.
 */
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

function problemStatementBrief(row: SubmissionWithProblemStatement): ProblemStatementBrief | null {
  if (row.ps_id === null || row.ps_code === null || row.ps_title === null) return null;
  return { id: row.ps_id, code: row.ps_code, title: row.ps_title };
}

export function submissionOut(row: SubmissionWithProblemStatement): SubmissionOut {
  return {
    id: row.id,
    project_title: row.project_title,
    team_identifier: row.team_identifier,
    short_description: row.short_description,
    additional_notes: row.additional_notes,
    problem_statement: problemStatementBrief(row),
    has_ppt: Boolean(row.ppt_file_path),
    has_pdf: Boolean(row.pdf_file_path),
    video_type: row.video_type as VideoType,
    video_url: row.video_url,
    has_video_file: Boolean(row.video_file_path),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function submissionJudgeOut(row: SubmissionWithProblemStatement): SubmissionJudgeOut {
  return {
    id: row.id,
    project_title: row.project_title,
    short_description: row.short_description,
    additional_notes: row.additional_notes,
    problem_statement: problemStatementBrief(row),
    has_ppt: Boolean(row.ppt_file_path),
    has_pdf: Boolean(row.pdf_file_path),
    video_type: row.video_type as VideoType,
    video_url: row.video_url,
    has_video_file: Boolean(row.video_file_path),
  };
}
