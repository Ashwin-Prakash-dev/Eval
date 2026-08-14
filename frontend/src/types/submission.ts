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

/**
 * One person on the team — every roster member, not only those who filled the form in.
 * `provided_details` is false for someone who wrote nothing, so the UI can say so rather
 * than omitting them and making the team look smaller than it is.
 */
export interface MemberDetail {
  user_id: string;
  /** Nullable on the startathon side; a member may never have set a name. */
  name: string | null;
  is_leader: boolean;
  provided_details: boolean;
  about: string | null;
  resume_url: string | null;
  github: string | null;
  linkedin: string | null;
  /** null means never answered; [] means explicitly declared none. */
  project_links: string[] | null;
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
  members: MemberDetail[];
  created_at: string;
  updated_at: string | null;
}

/**
 * Review is not blind: judges see the team name and the member details too. Still a distinct
 * shape from SubmissionOut, which additionally carries created_at/updated_at.
 */
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
  members: MemberDetail[];
}
