import type { ApplicationRow } from "../repo/application";

/**
 * Team identity is enforced by type, not by filtering.
 *
 * `SubmissionOut` (admin) carries `team_identifier`; `SubmissionJudgeOut` structurally has
 * no such field, so a judge-facing response physically cannot contain it. Both mappers
 * build their object field by field and never spread a database row — spreading would
 * reintroduce the leak the moment a new column is added. See backend/app/schemas/
 * submission.py, which used two separate Pydantic models for the same reason.
 *
 * This matters more now than it did: every application row carries `team_name` from the
 * startathon join, so a judge response has to be built deliberately to keep it out.
 */

export interface PriorWork {
  kind: string;
  url?: string;
  description: string;
}

export interface SubmissionOut {
  id: string;
  project_title: string;
  team_identifier: string;
  short_description: string;
  problem_evidence: string;
  domains: string[] | null;
  prior_work: PriorWork[] | null;
  deck_url: string;
  video_url: string;
  created_at: string;
  updated_at: string | null;
}

export interface SubmissionJudgeOut {
  id: string;
  project_title: string;
  short_description: string;
  problem_evidence: string;
  domains: string[] | null;
  prior_work: PriorWork[] | null;
  deck_url: string;
  video_url: string;
}

/**
 * `domains` and `prior_work` are JSON documents where NULL and '[]' mean different things:
 * NULL is "the team never answered", '[]' is "the team declared none". The distinction is
 * preserved rather than collapsed to an empty array, because undeclared prior work is a
 * penalty offence on the startathon side and a judge has to be able to tell them apart.
 */
function parseJsonArray<T>(raw: string | null): T[] | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch {
    return null;
  }
}

/** Startathon timestamps are epoch integers; this API has always emitted ISO-8601. */
function toIso(epoch: number | null): string | null {
  if (epoch === null) return null;
  // Written in seconds. Guard anyway: a millisecond value read as seconds lands in the
  // year 56000 and would silently sort to the end of every list.
  const ms = epoch < 1e12 ? epoch * 1000 : epoch;
  return new Date(ms).toISOString();
}

export function submissionOut(row: ApplicationRow): SubmissionOut {
  return {
    id: row.team_id,
    project_title: row.title,
    team_identifier: row.team_name,
    short_description: row.summary,
    problem_evidence: row.problem_evidence,
    domains: parseJsonArray<string>(row.domains),
    prior_work: parseJsonArray<PriorWork>(row.prior_work),
    deck_url: row.deck_url,
    video_url: row.video_url,
    created_at: toIso(row.created_at) ?? "",
    updated_at: toIso(row.updated_at),
  };
}

export function submissionJudgeOut(row: ApplicationRow): SubmissionJudgeOut {
  return {
    id: row.team_id,
    project_title: row.title,
    short_description: row.summary,
    problem_evidence: row.problem_evidence,
    domains: parseJsonArray<string>(row.domains),
    prior_work: parseJsonArray<PriorWork>(row.prior_work),
    deck_url: row.deck_url,
    video_url: row.video_url,
  };
}
