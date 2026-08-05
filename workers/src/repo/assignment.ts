import { nowIso } from "../lib/time";

export interface AssignmentRow {
  id: number;
  submission_id: number;
  judge_id: number;
  assigned_by_id: number | null;
  source: string;
  assigned_at: string;
}

/** Joined shape backing AssignmentOut, replacing the three joinedloads in the CRUD layer. */
export interface AssignmentJoined extends AssignmentRow {
  submission_title: string;
  submission_team: string;
  judge_email: string;
  judge_full_name: string | null;
  evaluation_status: string | null;
}

export interface ConflictRow {
  id: number;
  submission_id: number;
  judge_id: number;
  reason: string | null;
  created_at: string;
}

const SELECT_JOINED = `
  SELECT a.*,
         s.project_title   AS submission_title,
         s.team_identifier AS submission_team,
         u.email           AS judge_email,
         u.full_name       AS judge_full_name,
         e.status          AS evaluation_status
  FROM assignments a
  JOIN submissions s ON s.id = a.submission_id
  JOIN users u       ON u.id = a.judge_id
  LEFT JOIN evaluations e ON e.assignment_id = a.id
`;

export async function listAll(
  db: D1Database,
  judgeId?: number | null,
  submissionId?: number | null
): Promise<AssignmentJoined[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (judgeId) {
    where.push("a.judge_id = ?");
    params.push(judgeId);
  }
  if (submissionId) {
    where.push("a.submission_id = ?");
    params.push(submissionId);
  }
  const clause = where.length ? ` WHERE ${where.join(" AND ")}` : "";
  const { results } = await db
    .prepare(`${SELECT_JOINED}${clause} ORDER BY a.assigned_at DESC`)
    .bind(...params)
    .all<AssignmentJoined>();
  return results;
}

export async function get(db: D1Database, assignmentId: number): Promise<AssignmentJoined | null> {
  return db
    .prepare(`${SELECT_JOINED} WHERE a.id = ?`)
    .bind(assignmentId)
    .first<AssignmentJoined>();
}

export async function exists(
  db: D1Database,
  submissionId: number,
  judgeId: number
): Promise<boolean> {
  const row = await db
    .prepare("SELECT COUNT(*) AS count FROM assignments WHERE submission_id = ? AND judge_id = ?")
    .bind(submissionId, judgeId)
    .first<{ count: number }>();
  return (row?.count ?? 0) > 0;
}

/** Creating an assignment always creates its paired evaluation shell, as the ORM did. */
export async function create(
  db: D1Database,
  submissionId: number,
  judgeId: number,
  assignedById: number | null,
  source: string
): Promise<AssignmentJoined | null> {
  const timestamp = nowIso();
  const row = await db
    .prepare(
      `INSERT INTO assignments (submission_id, judge_id, assigned_by_id, source, assigned_at)
       VALUES (?, ?, ?, ?, ?) RETURNING id`
    )
    .bind(submissionId, judgeId, assignedById, source, timestamp)
    .first<{ id: number }>();
  if (!row) throw new Error("Failed to create assignment");

  await db
    .prepare(
      `INSERT INTO evaluations (assignment_id, submission_id, judge_id, status, updated_at)
       VALUES (?, ?, ?, 'not_started', ?)`
    )
    .bind(row.id, submissionId, judgeId, timestamp)
    .run();

  return get(db, row.id);
}

export async function remove(db: D1Database, assignmentId: number): Promise<void> {
  await db.prepare("DELETE FROM assignments WHERE id = ?").bind(assignmentId).run();
}

export async function deleteAll(db: D1Database): Promise<number> {
  const row = await db.prepare("SELECT COUNT(*) AS count FROM assignments").first<{ count: number }>();
  await db.prepare("DELETE FROM assignments").run();
  return row?.count ?? 0;
}

export async function loadCountsByJudge(db: D1Database): Promise<Map<number, number>> {
  const { results } = await db
    .prepare("SELECT judge_id, COUNT(*) AS count FROM assignments GROUP BY judge_id")
    .all<{ judge_id: number; count: number }>();
  return new Map(results.map((r) => [r.judge_id, r.count]));
}

export async function allAssignmentPairs(db: D1Database): Promise<Map<number, Set<number>>> {
  const { results } = await db
    .prepare("SELECT submission_id, judge_id FROM assignments")
    .all<{ submission_id: number; judge_id: number }>();
  const map = new Map<number, Set<number>>();
  for (const row of results) {
    const set = map.get(row.submission_id) ?? new Set<number>();
    set.add(row.judge_id);
    map.set(row.submission_id, set);
  }
  return map;
}

export async function allConflictPairs(db: D1Database): Promise<Set<string>> {
  const { results } = await db
    .prepare("SELECT submission_id, judge_id FROM conflict_exclusions")
    .all<{ submission_id: number; judge_id: number }>();
  return new Set(results.map((r) => `${r.submission_id}:${r.judge_id}`));
}

/**
 * Inserts every generated pair plus its evaluation. D1 has no interactive transaction, so
 * the whole set goes through one batch() — which is atomic — rather than the ORM's
 * flush-per-row inside a single commit.
 */
export async function bulkCreate(
  db: D1Database,
  pairs: [number, number][],
  assignedById: number | null
): Promise<number> {
  if (pairs.length === 0) return 0;
  const timestamp = nowIso();

  const inserts = pairs.map(([submissionId, judgeId]) =>
    db
      .prepare(
        `INSERT INTO assignments (submission_id, judge_id, assigned_by_id, source, assigned_at)
         VALUES (?, ?, ?, 'auto', ?)`
      )
      .bind(submissionId, judgeId, assignedById, timestamp)
  );
  await db.batch(inserts);

  // Pair each new assignment with its evaluation by (submission, judge), which is unique.
  const evaluations = pairs.map(([submissionId, judgeId]) =>
    db
      .prepare(
        `INSERT INTO evaluations (assignment_id, submission_id, judge_id, status, updated_at)
         SELECT a.id, a.submission_id, a.judge_id, 'not_started', ?
         FROM assignments a
         WHERE a.submission_id = ? AND a.judge_id = ?
           AND NOT EXISTS (SELECT 1 FROM evaluations e WHERE e.assignment_id = a.id)`
      )
      .bind(timestamp, submissionId, judgeId)
  );
  await db.batch(evaluations);

  return pairs.length;
}

// ---- conflict exclusions ----

export async function listConflicts(db: D1Database): Promise<ConflictRow[]> {
  const { results } = await db
    .prepare("SELECT * FROM conflict_exclusions ORDER BY created_at DESC")
    .all<ConflictRow>();
  return results;
}

export async function getConflict(db: D1Database, conflictId: number): Promise<ConflictRow | null> {
  return db
    .prepare("SELECT * FROM conflict_exclusions WHERE id = ?")
    .bind(conflictId)
    .first<ConflictRow>();
}

export async function createConflict(
  db: D1Database,
  submissionId: number,
  judgeId: number,
  reason: string | null
): Promise<ConflictRow> {
  const row = await db
    .prepare(
      "INSERT INTO conflict_exclusions (submission_id, judge_id, reason, created_at) VALUES (?, ?, ?, ?) RETURNING *"
    )
    .bind(submissionId, judgeId, reason, nowIso())
    .first<ConflictRow>();
  if (!row) throw new Error("Failed to create conflict exclusion");
  return row;
}

export async function deleteConflict(db: D1Database, conflictId: number): Promise<void> {
  await db.prepare("DELETE FROM conflict_exclusions WHERE id = ?").bind(conflictId).run();
}
