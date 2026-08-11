/**
 * Submissions are `startathon_applications`, read from the startathon event database. This
 * app never writes them: there is no create, update or delete, and the deck and video are
 * URLs owned by that system rather than files stored here.
 *
 * `id` is the startathon `team_id` — a string, not a number.
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
  /** null means the team never answered; [] means they explicitly declared none. */
  domains: string[] | null;
  /** null means the team never answered; [] means they explicitly declared none. */
  prior_work: PriorWork[] | null;
  deck_url: string;
  video_url: string;
  created_at: string;
  updated_at: string | null;
}

/** Structurally omits team_identifier, so a judge view cannot render it. */
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
