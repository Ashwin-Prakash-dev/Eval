import type { ApplicationRow } from "../repo/application";

/**
 * Two shapes, built field by field.
 *
 * Review is no longer blind: judges see `team_identifier` exactly as admins do. The masking
 * that used to keep it out of `SubmissionJudgeOut` was removed deliberately -- once member
 * details (GitHub, LinkedIn, resumes) reach the judge view, withholding the registered team
 * name hides nothing and only makes the response harder to reason about.
 *
 * The two mappers stay separate regardless. They still differ -- `created_at` and
 * `updated_at` are admin-only, since a judge has no use for them and `updated_at` is the
 * signal the staleness check is built on. More to the point, neither mapper ever spreads a
 * database row: every field is named. A new column added to the startathon side therefore
 * reaches an API response only when someone writes it out here, which is the property worth
 * keeping whether or not anything is currently being withheld.
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
  team_identifier: string;
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

/**
 * Startathon timestamps are epoch integers; this API has always emitted ISO-8601.
 *
 * Exported because the evaluation routes surface `submission_updated_at` alongside the
 * staleness flag ("edited 2 hours ago"). It is passed as a sibling field rather than added to
 * SubmissionJudgeOut, so that type keeps its guarantee of carrying nothing but what a judge
 * may see.
 */
export function toIso(epoch: number | null): string | null {
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
    team_identifier: row.team_name,
    short_description: row.summary,
    problem_evidence: row.problem_evidence,
    domains: parseJsonArray<string>(row.domains),
    prior_work: parseJsonArray<PriorWork>(row.prior_work),
    deck_url: row.deck_url,
    video_url: row.video_url,
  };
}
