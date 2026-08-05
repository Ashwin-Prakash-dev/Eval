import { nowIso } from "../lib/time";

export interface EvaluationRow {
  id: number;
  assignment_id: number;
  submission_id: number;
  judge_id: number;
  status: string;
  weighted_overall_score: number | null;
  time_spent_seconds: number;
  started_at: string | null;
  completed_at: string | null;
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
  const placeholders = ids.map(() => "?").join(", ");

  const [{ results: scores }, { results: comments }] = await db.batch<
    ScoreRow | { evaluation_id: number; body: string }
  >([
    db
      .prepare(`SELECT * FROM evaluation_scores WHERE evaluation_id IN (${placeholders}) ORDER BY id`)
      .bind(...ids),
    db
      .prepare(`SELECT evaluation_id, body FROM comments WHERE evaluation_id IN (${placeholders})`)
      .bind(...ids),
  ]);

  const scoresBy = new Map<number, ScoreRow[]>();
  for (const s of scores as ScoreRow[]) {
    const list = scoresBy.get(s.evaluation_id) ?? [];
    list.push(s);
    scoresBy.set(s.evaluation_id, list);
  }
  const commentBy = new Map<number, string>();
  for (const c of comments as { evaluation_id: number; body: string }[]) {
    commentBy.set(c.evaluation_id, c.body);
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

export async function getByAssignment(
  db: D1Database,
  assignmentId: number
): Promise<EvaluationWithDetail | null> {
  const row = await db
    .prepare("SELECT * FROM evaluations WHERE assignment_id = ?")
    .bind(assignmentId)
    .first<EvaluationRow>();
  if (!row) return null;
  return (await attachDetail(db, [row]))[0] ?? null;
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
  submissionId: number
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
  sets.push("updated_at = ?");
  values.push(nowIso(), evaluationId);
  await db
    .prepare(`UPDATE evaluations SET ${sets.join(", ")} WHERE id = ?`)
    .bind(...values)
    .run();
}
