/**
 * Did the applicant change their submission after it was reviewed?
 *
 * This is the single choke point for that question. Every read path that shows a judge or an
 * admin an evaluation, and the reset that discards a stale one, all call `needsReevaluation`
 * here -- so a GET's badge and the write that acts on it can never disagree about what counts
 * as stale.
 *
 * The signal is a content hash, not a timestamp. `startathon_applications.updated_at` is
 * nullable, has no default or trigger, and is maintained by scc-api-worker, which lives
 * outside this repo: if one edit path there forgets to bump it, a timestamp comparison fails
 * silently and forever. Hashing the reviewed fields cannot miss an edit, and cannot fire on a
 * no-op re-save either. `updated_at` is still surfaced in the UI to say *when* the edit
 * happened; it never decides *whether* there was one.
 */

import type { ApplicationRow } from "../repo/application";

const encoder = new TextEncoder();

/**
 * The fields that constitute "what was reviewed". Anything a judge scores against belongs
 * here; anything they never see must not, or an irrelevant edit would discard real work.
 * `team_name` is deliberately absent -- judges never see it (see submissionJudgeOut), so a
 * team rename is not a change to the thing being judged.
 *
 * Serialized as an ARRAY, not an object: array order is fixed by the literal below, whereas
 * an object would hash differently if a key were ever reordered or renamed. `prior_work` and
 * `domains` are hashed as the raw stored JSON text rather than parsed and re-serialized, so
 * the digest reflects exactly what the startathon side stored.
 */
export async function applicationContentHash(row: ApplicationRow): Promise<string> {
  const canonical = JSON.stringify([
    row.title,
    row.summary,
    row.problem_evidence,
    row.deck_url,
    row.video_url,
    row.prior_work,
    row.domains,
  ]);
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(canonical));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Hashes a whole list in one pass, for the read paths that already hold every application in
 * memory (the judge worklist, the leaderboard, coverage). Keyed by team_id so a caller can
 * look up per row inside a loop it is already running -- no extra query and no N+1.
 */
export async function contentHashesByTeamId(
  applications: ApplicationRow[]
): Promise<Map<string, string>> {
  const hashes = await Promise.all(applications.map((a) => applicationContentHash(a)));
  return new Map(applications.map((a, i) => [a.team_id, hashes[i]!]));
}

/** The subset of an evaluation this check needs, so callers can pass any row shape. */
export interface RevisionCheckable {
  status: string;
  reviewed_content_hash: string | null;
}

/**
 * Whether this evaluation was made against content that has since changed.
 *
 * Three deliberate non-cases:
 *
 * - `not_started` / `in_progress` are never stale. There is nothing to invalidate; an
 *   unfinished review is simply unfinished, and the judge will see the current content when
 *   they get to it.
 * - A NULL hash is NOT stale. It means the evaluation was completed before this column
 *   existed, so there is no record of what was reviewed. Flagging on NULL would mark every
 *   pre-existing review stale on the deploy.
 * - A missing application (`currentHash === null`) is not stale either. The team was deleted
 *   on the startathon side; that is a different problem and discarding scores would not fix it.
 */
export function needsReevaluation(
  evaluation: RevisionCheckable | null | undefined,
  currentHash: string | null | undefined
): boolean {
  if (!evaluation || evaluation.status !== "completed") return false;
  if (evaluation.reviewed_content_hash === null) return false;
  if (currentHash === null || currentHash === undefined) return false;
  return evaluation.reviewed_content_hash !== currentHash;
}
