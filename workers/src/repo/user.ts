import { toUser, type User, type UserRole, type UserRow } from "../db";
import { nowIso } from "../lib/time";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function getById(db: D1Database, userId: number): Promise<User | null> {
  const row = await db.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first<UserRow>();
  return row ? toUser(row) : null;
}

export async function getByEmail(db: D1Database, email: string): Promise<User | null> {
  const row = await db
    .prepare("SELECT * FROM users WHERE email = ?")
    .bind(normalizeEmail(email))
    .first<UserRow>();
  return row ? toUser(row) : null;
}

export async function createUser(
  db: D1Database,
  email: string,
  role: UserRole,
  fullName: string | null
): Promise<User> {
  const row = await db
    .prepare("INSERT INTO users (email, full_name, role, created_at) VALUES (?, ?, ?, ?) RETURNING *")
    .bind(normalizeEmail(email), fullName, role, nowIso())
    .first<UserRow>();
  if (!row) throw new Error("Failed to create user");
  return toUser(row);
}

export async function listJudges(db: D1Database, search?: string | null): Promise<User[]> {
  const statement = search
    ? db
        .prepare(
          "SELECT * FROM users WHERE role = 'judge' AND (email LIKE ?1 OR full_name LIKE ?1) ORDER BY created_at DESC"
        )
        .bind(`%${search}%`)
    : db.prepare("SELECT * FROM users WHERE role = 'judge' ORDER BY created_at DESC");
  const { results } = await statement.all<UserRow>();
  return results.map(toUser);
}

/**
 * Anyone who has opened at least one evaluation, regardless of account role. Assignments are
 * gone and admins may review too, so "who produced review data" is no longer the same
 * question as "who holds the judge role" -- this answers the former, for performance
 * reporting (judge stats, the report export). listJudges above still answers the latter, for
 * the judge-account management screen, which is deliberately scoped to role = 'judge'.
 */
export async function listReviewers(db: D1Database): Promise<User[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM users
       WHERE id IN (SELECT DISTINCT judge_id FROM evaluations)
       ORDER BY created_at DESC`
    )
    .all<UserRow>();
  return results.map(toUser);
}

export async function updateUser(
  db: D1Database,
  userId: number,
  fields: { full_name?: string | null; is_active?: boolean; role?: UserRole; last_login?: string }
): Promise<User | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  if (fields.full_name !== undefined) {
    sets.push("full_name = ?");
    values.push(fields.full_name);
  }
  if (fields.is_active !== undefined) {
    sets.push("is_active = ?");
    values.push(fields.is_active ? 1 : 0);
  }
  if (fields.role !== undefined) {
    sets.push("role = ?");
    values.push(fields.role);
  }
  if (fields.last_login !== undefined) {
    sets.push("last_login = ?");
    values.push(fields.last_login);
  }
  if (sets.length === 0) return getById(db, userId);

  values.push(userId);
  const row = await db
    .prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ? RETURNING *`)
    .bind(...values)
    .first<UserRow>();
  return row ? toUser(row) : null;
}
