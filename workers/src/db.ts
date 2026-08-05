/**
 * Row shapes as D1 returns them, plus the mappers to domain objects.
 *
 * SQLite has no boolean type, so `is_active`/`is_flagged` come back as 0/1 integers and
 * must be converted at the boundary — the FastAPI responses were true booleans and the
 * frontend types expect the same.
 */
export type UserRole = "admin" | "judge";

export interface UserRow {
  id: number;
  email: string;
  full_name: string | null;
  role: string;
  is_active: number;
  created_at: string;
  last_login: string | null;
}

export interface User {
  id: number;
  email: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  last_login: string | null;
}

export interface AllowedEmailRow {
  id: number;
  email: string;
  role: string;
  full_name: string | null;
  note: string | null;
  is_active: number;
  created_at: string;
  created_by_id: number | null;
}

export interface AllowedEmail {
  id: number;
  email: string;
  role: UserRole;
  full_name: string | null;
  note: string | null;
  is_active: boolean;
  created_at: string;
  created_by_id: number | null;
}

export interface OtpCodeRow {
  id: number;
  email: string;
  code_hash: string;
  expires_at: string;
  consumed_at: string | null;
  attempts: number;
  created_at: string;
}

export function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    role: row.role as UserRole,
    is_active: row.is_active === 1,
    created_at: row.created_at,
    last_login: row.last_login,
  };
}

export function toAllowedEmail(row: AllowedEmailRow): AllowedEmail {
  return {
    id: row.id,
    email: row.email,
    role: row.role as UserRole,
    full_name: row.full_name,
    note: row.note,
    is_active: row.is_active === 1,
    created_at: row.created_at,
    created_by_id: row.created_by_id,
  };
}

/** Mirrors User.display_name in backend/app/models/user.py. */
export function displayName(user: Pick<User, "full_name" | "email">): string {
  return user.full_name || user.email;
}

export const bool = (value: boolean): number => (value ? 1 : 0);
