import { nowIso } from "../lib/time";

export interface EvaluationRow {
  id: number;
  submission_id: string;
  judge_id: number;
  status: string;
  weighted_overall_score: number | null;
  time_spent_seconds: number;
  started_at: string | null;
  completed_at: string | null;
  /** 0/1. A judge's private bookmark; never serialised into an admin response. */
  flagged_for_review: number;
  /**
   * SHA-256 of the application content this review was completed against, or NULL for a
   * review completed before the column existed. See src/services/revision.ts.
   */
  reviewed_content_hash: string | null;
  updated_at: string;
}

export interface ScoreRow {
  id: number;
  evaluation_id: number;
  criterion_id: number;
  score: number | null;
  comment: string | null;
}

export interface EvaluationWithDetail extends EvaluationRow {
  scores: ScoreRow[];
  overall_comment: string | null;
}

async function attachDetail(
  db: D1Database,
  rows: EvaluationRow[]
): Promise<EvaluationWithDetail[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const scoresBy = new Map<number, ScoreRow[]>();
  const commentBy = new Map<number, string>();

  /**
   * D1 caps bound parameters per statement, so the ids are chunked rather than sent as one
   * IN list -- the same cap `byIds` and `membersByTeamIds` chunk for.
   *
   * This was unchunked, and the ceiling is per JUDGE, not per event: `listForJudge` passes
   * every evaluation the judge owns. Once a judge had opened more than ~100 submissions,
   * both their worklist and their progress query threw, and the dashboard rendered as an
   * empty event -- no submissions, no counts -- while their saved reviews were untouched.
   * It therefore stayed invisible until one judge crossed the line late in a real event.
   */
  const CHUNK = 90;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const placeholders = chunk.map(() => "?").join(", ");

    const [{ results: scores }, { results: comments }] = await db.batch<
      ScoreRow | { evaluation_id: number; body: string }
    >([
      db
        .prepare(`SELECT * FROM evaluation_scores WHERE evaluation_id IN (${placeholders}) ORDER BY id`)
        .bind(...chunk),
      db
        .prepare(`SELECT evaluation_id, body FROM comments WHERE evaluation_id IN (${placeholders})`)
        .bind(...chunk),
    ]);

    for (const s of scores as ScoreRow[]) {
      const list = scoresBy.get(s.evaluation_id) ?? [];
      list.push(s);
      scoresBy.set(s.evaluation_id, list);
    }
    for (const c of comments as { evaluation_id: number; body: string }[]) {
      commentBy.set(c.evaluation_id, c.body);
    }
  }

  return rows.map((row) => ({
    ...row,
    scores: scoresBy.get(row.id) ?? [],
    overall_comment: commentBy.get(row.id) ?? null,
  }));
}

export async function get(db: D1Database, evaluationId: number): Promise<EvaluationWithDetail | null> {
  const row = await db
    .prepare("SELECT * FROM evaluations WHERE id = ?")
    .bind(evaluationId)
    .first<EvaluationRow>();
  if (!row) return null;
  return (await attachDetail(db, [row]))[0] ?? null;
}

export async function getForJudge(
  db: D1Database,
  submissionId: string,
  judgeId: number
): Promise<EvaluationWithDetail | null> {
  const row = await db
    .prepare("SELECT * FROM evaluations WHERE submission_id = ? AND judge_id = ?")
    .bind(submissionId, judgeId)
    .first<EvaluationRow>();
  if (!row) return null;
  return (await attachDetail(db, [row]))[0] ?? null;
}

/**
 * There is no assignment step any more, so an evaluation comes into existence the first time
 * a judge opens a submission. The INSERT relies on the (submission_id, judge_id) unique
 * constraint rather than a check-then-insert: two concurrent opens by the same judge would
 * otherwise both see "no row" and race. `ON CONFLICT DO NOTHING` makes the loser a no-op and
 * the follow-up read returns whichever row won.
 */
export async function getOrCreateForJudge(
  db: D1Database,
  submissionId: string,
  judgeId: number
): Promise<EvaluationWithDetail> {
  await db
    .prepare(
      `INSERT INTO evaluations (submission_id, judge_id, status, updated_at)
       VALUES (?, ?, 'not_started', ?)
       ON CONFLICT (submission_id, judge_id) DO NOTHING`
    )
    .bind(submissionId, judgeId, nowIso())
    .run();

  const evaluation = await getForJudge(db, submissionId, judgeId);
  if (!evaluation) throw new Error("Failed to create evaluation");
  return evaluation;
}

export async function listForJudge(db: D1Database, judgeId: number): Promise<EvaluationWithDetail[]> {
  const { results } = await db
    .prepare("SELECT * FROM evaluations WHERE judge_id = ?")
    .bind(judgeId)
    .all<EvaluationRow>();
  return attachDetail(db, results);
}

export async function listForSubmission(
  db: D1Database,
  submissionId: string
): Promise<(EvaluationWithDetail & { judge_email: string; judge_full_name: string | null })[]> {
  const { results } = await db
    .prepare(
      `SELECT e.*, u.email AS judge_email, u.full_name AS judge_full_name
       FROM evaluations e JOIN users u ON u.id = e.judge_id
       WHERE e.submission_id = ?`
    )
    .bind(submissionId)
    .all<EvaluationRow & { judge_email: string; judge_full_name: string | null }>();
  const detailed = await attachDetail(db, results);
  return detailed.map((d, i) => ({
    ...d,
    judge_email: results[i]!.judge_email,
    judge_full_name: results[i]!.judge_full_name,
  }));
}

/**
 * Matches crud/evaluation.upsert_score: on an existing row a null score or comment is
 * IGNORED rather than clearing the stored value; on insert both are written as given.
 */
export async function upsertScore(
  db: D1Database,
  evaluationId: number,
  criterionId: number,
  score: number | null,
  comment: string | null
): Promise<void> {
  const existing = await db
    .prepare("SELECT id FROM evaluation_scores WHERE evaluation_id = ? AND criterion_id = ?")
    .bind(evaluationId, criterionId)
    .first<{ id: number }>();

  if (existing) {
    const sets: string[] = [];
    const values: unknown[] = [];
    if (score !== null) {
      sets.push("score = ?");
      values.push(score);
    }
    if (comment !== null) {
      sets.push("comment = ?");
      values.push(comment);
    }
    if (sets.length === 0) return;
    sets.push("updated_at = ?");
    values.push(nowIso(), existing.id);
    await db
      .prepare(`UPDATE evaluation_scores SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();
    return;
  }

  await db
    .prepare(
      `INSERT INTO evaluation_scores (evaluation_id, criterion_id, score, comment, updated_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(evaluationId, criterionId, score, comment, nowIso())
    .run();
}

export async function upsertComment(
  db: D1Database,
  evaluationId: number,
  body: string
): Promise<void> {
  const existing = await db
    .prepare("SELECT id FROM comments WHERE evaluation_id = ?")
    .bind(evaluationId)
    .first<{ id: number }>();
  if (existing) {
    await db
      .prepare("UPDATE comments SET body = ?, updated_at = ? WHERE id = ?")
      .bind(body, nowIso(), existing.id)
      .run();
    return;
  }
  await db
    .prepare("INSERT INTO comments (evaluation_id, body, created_at, updated_at) VALUES (?, ?, ?, ?)")
    .bind(evaluationId, body, nowIso(), nowIso())
    .run();
}

export async function applyAutosave(
  db: D1Database,
  evaluationId: number,
  fields: {
    started_at?: string;
    time_spent_seconds?: number;
    status?: string;
    completed_at?: string | null;
    reviewed_content_hash?: string | null;
  }
): Promise<void> {
  const sets: string[] = [];
  const values: unknown[] = [];
  if (fields.started_at !== undefined) {
    sets.push("started_at = ?");
    values.push(fields.started_at);
  }
  if (fields.time_spent_seconds !== undefined) {
    sets.push("time_spent_seconds = ?");
    values.push(fields.time_spent_seconds);
  }
  if (fields.status !== undefined) {
    sets.push("status = ?");
    values.push(fields.status);
  }
  if (fields.completed_at !== undefined) {
    sets.push("completed_at = ?");
    values.push(fields.completed_at);
  }
  if (fields.reviewed_content_hash !== undefined) {
    sets.push("reviewed_content_hash = ?");
    values.push(fields.reviewed_content_hash);
  }
  sets.push("updated_at = ?");
  values.push(nowIso(), evaluationId);
  await db
    .prepare(`UPDATE evaluations SET ${sets.join(", ")} WHERE id = ?`)
    .bind(...values)
    .run();
}

/** The shape the staleness check needs; satisfies RevisionCheckable in services/revision.ts. */
export interface CompletedEvaluationRef {
  id: number;
  status: string;
  reviewed_content_hash: string | null;
}

/**
 * Every completed evaluation, grouped by submission, carrying the hash of what it was scored
 * against.
 *
 * Replaces the old `completedCountsBySubmission`, which returned a bare COUNT. A count can no
 * longer be taken at face value: a completed review whose submission has since been edited
 * must not be counted toward coverage or the score, and deciding that needs the hash. Callers
 * filter with `needsReevaluation` and count what survives.
 *
 * One query for the whole field, so the callers that already loop over every application
 * (the judge worklist, coverage, the leaderboard) stay at two reads rather than an N+1.
 */
export async function completedBySubmission(
  db: D1Database
): Promise<Map<string, CompletedEvaluationRef[]>> {
  const { results } = await db
    .prepare(
      `SELECT id, submission_id, status, reviewed_content_hash
       FROM evaluations WHERE status = 'completed'`
    )
    .all<{ id: number; submission_id: string; status: string; reviewed_content_hash: string | null }>();

  const bySubmission = new Map<string, CompletedEvaluationRef[]>();
  for (const row of results) {
    const list = bySubmission.get(row.submission_id) ?? [];
    list.push({ id: row.id, status: row.status, reviewed_content_hash: row.reviewed_content_hash });
    bySubmission.set(row.submission_id, list);
  }
  return bySubmission;
}

/**
 * Discards a stale review and returns the evaluation to a blank not_started state.
 *
 * This is a HARD DELETE of the judge's scores and overall comment -- the deliberate choice
 * over pre-filling the old values, so the judge re-reads changed content without being
 * anchored to what they scored the previous version. Because that is irreversible, two things
 * guard it: the caller records the discarded values in the audit log first, and the route
 * requires an explicit confirmation before calling this at all.
 *
 * Batched so a failure cannot leave scores deleted but the row still marked completed.
 * `reviewed_content_hash` is left alone on purpose: staleness is only ever evaluated for
 * status = 'completed', so the leftover value is inert and a re-completion overwrites it.
 */
export async function resetForReevaluation(
  db: D1Database,
  evaluationId: number
): Promise<void> {
  await db.batch([
    db.prepare("DELETE FROM evaluation_scores WHERE evaluation_id = ?").bind(evaluationId),
    db.prepare("DELETE FROM comments WHERE evaluation_id = ?").bind(evaluationId),
    db
      .prepare(
        `UPDATE evaluations
         SET status = 'not_started', completed_at = NULL, started_at = NULL,
             time_spent_seconds = 0, weighted_overall_score = NULL, updated_at = ?
         WHERE id = ?`
      )
      .bind(nowIso(), evaluationId),
  ]);
}

export async function setFlagged(
  db: D1Database,
  evaluationId: number,
  flagged: boolean
): Promise<void> {
  await db
    .prepare("UPDATE evaluations SET flagged_for_review = ?, updated_at = ? WHERE id = ?")
    .bind(flagged ? 1 : 0, nowIso(), evaluationId)
    .run();
}
