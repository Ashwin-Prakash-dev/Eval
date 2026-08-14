import type { ApplicationRow, MemberRow } from "../repo/application";

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

/**
 * One person on the team.
 *
 * Present for every roster member, including those who wrote nothing -- `provided_details`
 * says which is which, so the UI can show "nothing provided" rather than omitting them and
 * making the team look smaller than it is.
 *
 * `name` stays nullable rather than being defaulted to the email or the id here: the two
 * fallbacks read very differently in a UI and that is a rendering decision, not a
 * serialization one. Nothing else from the user row crosses over -- no email, phone,
 * college or gender.
 */
export interface MemberDetail {
  user_id: string;
  name: string | null;
  is_leader: boolean;
  /** False when this member has no row in startathon_application_members at all. */
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
  domains: string[] | null;
  prior_work: PriorWork[] | null;
  deck_url: string;
  video_url: string;
  members: MemberDetail[];
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
  members: MemberDetail[];
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

/**
 * A member row whose detail columns are all null came from the LEFT JOIN finding nothing --
 * that member is on the team but wrote nothing. `updated_at` is the discriminator rather
 * than the content columns, because it is NOT NULL in
 * `startathon_application_members`: a member who saved the form and then cleared every field
 * still has a row, and is legitimately "provided details, all of them empty".
 */
function memberDetail(row: MemberRow): MemberDetail {
  return {
    user_id: row.user_id,
    name: row.name,
    is_leader: row.role === "leader",
    provided_details: row.updated_at !== null,
    about: row.about,
    resume_url: row.resume_url,
    github: row.github,
    linkedin: row.linkedin,
    project_links: parseJsonArray<string>(row.project_links),
  };
}

export function submissionOut(row: ApplicationRow, members: MemberRow[] = []): SubmissionOut {
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
    members: members.map(memberDetail),
    created_at: toIso(row.created_at) ?? "",
    updated_at: toIso(row.updated_at),
  };
}

export function submissionJudgeOut(
  row: ApplicationRow,
  members: MemberRow[] = []
): SubmissionJudgeOut {
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
    members: members.map(memberDetail),
  };
}
