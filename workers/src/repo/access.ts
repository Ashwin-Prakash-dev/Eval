import {
  toAllowedEmail,
  toUser,
  type AllowedEmail,
  type AllowedEmailRow,
  type OtpCodeRow,
  type User,
  type UserRole,
  type UserRow,
} from "../db";
import { addMinutes, minutesAgoIso, nowIso, secondsSince } from "../lib/time";
import { normalizeEmail } from "./user";

export async function getAllowed(db: D1Database, allowedId: number): Promise<AllowedEmail | null> {
  const row = await db
    .prepare("SELECT * FROM allowed_emails WHERE id = ?")
    .bind(allowedId)
    .first<AllowedEmailRow>();
  return row ? toAllowedEmail(row) : null;
}

export async function getAllowedByEmail(db: D1Database, email: string): Promise<AllowedEmail | null> {
  const row = await db
    .prepare("SELECT * FROM allowed_emails WHERE email = ?")
    .bind(normalizeEmail(email))
    .first<AllowedEmailRow>();
  return row ? toAllowedEmail(row) : null;
}

export async function listAllowed(db: D1Database, search?: string | null): Promise<AllowedEmail[]> {
  const statement = search
    ? db
        .prepare(
          "SELECT * FROM allowed_emails WHERE email LIKE ?1 OR full_name LIKE ?1 ORDER BY created_at DESC"
        )
        .bind(`%${search}%`)
    : db.prepare("SELECT * FROM allowed_emails ORDER BY created_at DESC");
  const { results } = await statement.all<AllowedEmailRow>();
  return results.map(toAllowedEmail);
}

export async function createAllowed(
  db: D1Database,
  payload: { email: string; role: UserRole; full_name?: string | null; note?: string | null },
  createdById: number | null
): Promise<AllowedEmail> {
  const row = await db
    .prepare(
      `INSERT INTO allowed_emails (email, role, full_name, note, created_by_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING *`
    )
    .bind(
      normalizeEmail(payload.email),
      payload.role,
      payload.full_name ?? null,
      payload.note ?? null,
      createdById,
      nowIso()
    )
    .first<AllowedEmailRow>();
  if (!row) throw new Error("Failed to create allowed email");
  return toAllowedEmail(row);
}

export async function updateAllowed(
  db: D1Database,
  allowedId: number,
  fields: { role?: UserRole; full_name?: string | null; note?: string | null; is_active?: boolean }
): Promise<AllowedEmail | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  if (fields.role !== undefined) {
    sets.push("role = ?");
    values.push(fields.role);
  }
  if (fields.full_name !== undefined) {
    sets.push("full_name = ?");
    values.push(fields.full_name);
  }
  if (fields.note !== undefined) {
    sets.push("note = ?");
    values.push(fields.note);
  }
  if (fields.is_active !== undefined) {
    sets.push("is_active = ?");
    values.push(fields.is_active ? 1 : 0);
  }
  if (sets.length === 0) return getAllowed(db, allowedId);

  values.push(allowedId);
  const row = await db
    .prepare(`UPDATE allowed_emails SET ${sets.join(", ")} WHERE id = ? RETURNING *`)
    .bind(...values)
    .first<AllowedEmailRow>();
  return row ? toAllowedEmail(row) : null;
}

export async function deleteAllowed(db: D1Database, allowedId: number): Promise<void> {
  await db.prepare("DELETE FROM allowed_emails WHERE id = ?").bind(allowedId).run();
}

// ---- passcodes ----

export async function createOtp(
  db: D1Database,
  email: string,
  codeHash: string,
  ttlMinutes: number
): Promise<void> {
  await db
    .prepare("INSERT INTO otp_codes (email, code_hash, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .bind(normalizeEmail(email), codeHash, addMinutes(ttlMinutes).toISOString(), nowIso())
    .run();
}

/**
 * The most recent unconsumed passcode. Issuing a new one invalidates older ones (see
 * invalidateOutstanding), so at most one is ever live per address.
 */
export async function latestActiveOtp(db: D1Database, email: string): Promise<OtpCodeRow | null> {
  return db
    .prepare(
      `SELECT * FROM otp_codes WHERE email = ? AND consumed_at IS NULL
       ORDER BY created_at DESC, id DESC LIMIT 1`
    )
    .bind(normalizeEmail(email))
    .first<OtpCodeRow>();
}

export async function invalidateOutstanding(db: D1Database, email: string): Promise<void> {
  await db
    .prepare("UPDATE otp_codes SET consumed_at = ? WHERE email = ? AND consumed_at IS NULL")
    .bind(nowIso(), normalizeEmail(email))
    .run();
}

export async function consumeOtp(db: D1Database, otpId: number): Promise<void> {
  await db.prepare("UPDATE otp_codes SET consumed_at = ? WHERE id = ?").bind(nowIso(), otpId).run();
}

export async function recordFailedAttempt(db: D1Database, otpId: number): Promise<void> {
  await db.prepare("UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?").bind(otpId).run();
}

export async function countRecentRequests(
  db: D1Database,
  email: string,
  withinMinutes = 60
): Promise<number> {
  const row = await db
    .prepare("SELECT COUNT(*) AS count FROM otp_codes WHERE email = ? AND created_at >= ?")
    .bind(normalizeEmail(email), minutesAgoIso(withinMinutes))
    .first<{ count: number }>();
  return row?.count ?? 0;
}

export async function secondsSinceLastRequest(
  db: D1Database,
  email: string
): Promise<number | null> {
  const row = await db
    .prepare("SELECT created_at FROM otp_codes WHERE email = ? ORDER BY created_at DESC, id DESC LIMIT 1")
    .bind(normalizeEmail(email))
    .first<{ created_at: string }>();
  return row ? secondsSince(row.created_at) : null;
}

/**
 * Chunked for the same reason as attachDetail and byIds: D1 caps bound parameters per
 * statement. The only caller is the bulk approval route, where the email count is whatever
 * an admin pasted in -- a list of more than ~100 addresses would otherwise throw.
 */
export async function usersByEmail(db: D1Database, emails: string[]): Promise<Map<string, User>> {
  if (emails.length === 0) return new Map();

  const map = new Map<string, User>();
  const CHUNK = 90;
  for (let i = 0; i < emails.length; i += CHUNK) {
    const chunk = emails.slice(i, i + CHUNK);
    const placeholders = chunk.map(() => "?").join(", ");
    const { results } = await db
      .prepare(`SELECT * FROM users WHERE email IN (${placeholders})`)
      .bind(...chunk)
      .all<UserRow>();
    for (const row of results) map.set(row.email, toUser(row));
  }
  return map;
}
