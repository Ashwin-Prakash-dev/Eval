import type { SubmissionRow, SubmissionWithProblemStatement, VideoType } from "../db";
import { nowIso } from "../lib/time";

/**
 * Every read joins problem_statements so the serializer can build ProblemStatementBrief,
 * matching the joinedload(Submission.problem_statement) in the SQLAlchemy CRUD layer.
 */
const SELECT_WITH_PS = `
  SELECT s.*, p.id AS ps_id, p.code AS ps_code, p.title AS ps_title
  FROM submissions s
  LEFT JOIN problem_statements p ON p.id = s.problem_statement_id
`;

export interface SubmissionCreateInput {
  project_title: string;
  team_identifier: string;
  problem_statement_id?: number | null;
  short_description?: string;
  additional_notes?: string | null;
  video_type?: VideoType;
  video_url?: string | null;
}

export async function get(
  db: D1Database,
  submissionId: number
): Promise<SubmissionWithProblemStatement | null> {
  return db
    .prepare(`${SELECT_WITH_PS} WHERE s.id = ?`)
    .bind(submissionId)
    .first<SubmissionWithProblemStatement>();
}

export async function listPaginated(
  db: D1Database,
  page: number,
  pageSize: number,
  search?: string | null,
  problemStatementId?: number | null
): Promise<{ items: SubmissionWithProblemStatement[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];

  if (search) {
    where.push("(s.project_title LIKE ? OR s.team_identifier LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }
  if (problemStatementId) {
    where.push("s.problem_statement_id = ?");
    params.push(problemStatementId);
  }
  const clause = where.length ? ` WHERE ${where.join(" AND ")}` : "";

  const countRow = await db
    .prepare(`SELECT COUNT(*) AS count FROM submissions s${clause}`)
    .bind(...params)
    .first<{ count: number }>();
  const total = countRow?.count ?? 0;

  const { results } = await db
    .prepare(`${SELECT_WITH_PS}${clause} ORDER BY s.created_at DESC LIMIT ? OFFSET ?`)
    .bind(...params, pageSize, (page - 1) * pageSize)
    .all<SubmissionWithProblemStatement>();

  return { items: results, total };
}

export async function create(
  db: D1Database,
  data: SubmissionCreateInput,
  createdById: number | null
): Promise<SubmissionWithProblemStatement> {
  const timestamp = nowIso();
  const row = await db
    .prepare(
      `INSERT INTO submissions
         (project_title, team_identifier, problem_statement_id, short_description,
          additional_notes, video_type, video_url, created_by_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
    )
    .bind(
      data.project_title,
      data.team_identifier,
      data.problem_statement_id ?? null,
      data.short_description ?? "",
      data.additional_notes ?? null,
      data.video_type ?? "youtube",
      data.video_url ?? null,
      createdById,
      timestamp,
      timestamp
    )
    .first<{ id: number }>();
  if (!row) throw new Error("Failed to create submission");
  const created = await get(db, row.id);
  if (!created) throw new Error("Failed to read back created submission");
  return created;
}

export const UPDATABLE = [
  "project_title",
  "team_identifier",
  "problem_statement_id",
  "short_description",
  "additional_notes",
  "video_type",
  "video_url",
] as const;

/**
 * Only keys actually present in the request body are written, mirroring Pydantic's
 * `exclude_unset=True`. `updated_at` is set explicitly because SQLAlchemy's onupdate hook
 * was Python-side and has no D1 equivalent.
 */
export async function update(
  db: D1Database,
  submissionId: number,
  patch: Record<string, unknown>
): Promise<SubmissionWithProblemStatement | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const field of UPDATABLE) {
    if (Object.prototype.hasOwnProperty.call(patch, field)) {
      sets.push(`${field} = ?`);
      values.push(patch[field] ?? null);
    }
  }
  // An empty patch emitted no UPDATE at all under SQLAlchemy, so updated_at stayed put.
  if (sets.length === 0) return get(db, submissionId);

  sets.push("updated_at = ?");
  values.push(nowIso(), submissionId);

  await db
    .prepare(`UPDATE submissions SET ${sets.join(", ")} WHERE id = ?`)
    .bind(...values)
    .run();
  return get(db, submissionId);
}

export async function setFilePath(
  db: D1Database,
  submissionId: number,
  column: string,
  path: string | null,
  alsoSetVideoTypeUpload = false
): Promise<SubmissionWithProblemStatement | null> {
  const extra = alsoSetVideoTypeUpload ? ", video_type = 'upload'" : "";
  await db
    .prepare(`UPDATE submissions SET ${column} = ?${extra}, updated_at = ? WHERE id = ?`)
    .bind(path, nowIso(), submissionId)
    .run();
  return get(db, submissionId);
}

export async function remove(db: D1Database, submissionId: number): Promise<void> {
  await db.prepare("DELETE FROM submissions WHERE id = ?").bind(submissionId).run();
}

export async function insertBulk(
  db: D1Database,
  rows: SubmissionCreateInput[],
  createdById: number | null
): Promise<number> {
  if (rows.length === 0) return 0;
  const timestamp = nowIso();
  const statements = rows.map((data) =>
    db
      .prepare(
        `INSERT INTO submissions
           (project_title, team_identifier, problem_statement_id, short_description,
            additional_notes, video_type, video_url, created_by_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        data.project_title,
        data.team_identifier,
        data.problem_statement_id ?? null,
        data.short_description ?? "",
        data.additional_notes ?? null,
        data.video_type ?? "youtube",
        data.video_url ?? null,
        createdById,
        timestamp,
        timestamp
      )
  );
  await db.batch(statements);
  return rows.length;
}

export type { SubmissionRow };
