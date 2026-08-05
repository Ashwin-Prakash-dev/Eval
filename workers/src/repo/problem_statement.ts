import type { ProblemStatementRow } from "../db";
import { nowIso } from "../lib/time";

export async function listAll(db: D1Database): Promise<ProblemStatementRow[]> {
  const { results } = await db
    .prepare("SELECT * FROM problem_statements ORDER BY code")
    .all<ProblemStatementRow>();
  return results;
}

export async function get(db: D1Database, psId: number): Promise<ProblemStatementRow | null> {
  return db.prepare("SELECT * FROM problem_statements WHERE id = ?").bind(psId).first<ProblemStatementRow>();
}

export async function getByCode(db: D1Database, code: string): Promise<ProblemStatementRow | null> {
  return db
    .prepare("SELECT * FROM problem_statements WHERE code = ?")
    .bind(code)
    .first<ProblemStatementRow>();
}

export async function create(
  db: D1Database,
  data: { code: string; title: string; description?: string }
): Promise<ProblemStatementRow> {
  const row = await db
    .prepare(
      "INSERT INTO problem_statements (code, title, description, created_at) VALUES (?, ?, ?, ?) RETURNING *"
    )
    .bind(data.code, data.title, data.description ?? "", nowIso())
    .first<ProblemStatementRow>();
  if (!row) throw new Error("Failed to create problem statement");
  return row;
}

export async function update(
  db: D1Database,
  psId: number,
  patch: Record<string, unknown>
): Promise<ProblemStatementRow | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const field of ["code", "title", "description"] as const) {
    if (Object.prototype.hasOwnProperty.call(patch, field)) {
      sets.push(`${field} = ?`);
      values.push(patch[field]);
    }
  }
  if (sets.length === 0) return get(db, psId);
  values.push(psId);
  return db
    .prepare(`UPDATE problem_statements SET ${sets.join(", ")} WHERE id = ? RETURNING *`)
    .bind(...values)
    .first<ProblemStatementRow>();
}

export async function remove(db: D1Database, psId: number): Promise<void> {
  await db.prepare("DELETE FROM problem_statements WHERE id = ?").bind(psId).run();
}
