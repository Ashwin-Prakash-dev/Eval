import { nowIso } from "../lib/time";

export interface AuditLogRow {
  id: number;
  user_id: number | null;
  email: string | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  details: string | null;
  created_at: string;
}

/** `details` is a JSON document stored as TEXT, matching the SQLAlchemy JSON column. */
export async function create(
  db: D1Database,
  userId: number | null,
  action: string,
  entityType: string,
  entityId: number | null,
  details: Record<string, unknown>
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(userId, action, entityType, entityId, JSON.stringify(details), nowIso())
    .run();
}

export async function listPaginated(
  db: D1Database,
  page: number,
  pageSize: number,
  entityType?: string
): Promise<{ items: AuditLogRow[]; total: number }> {
  const clause = entityType ? " WHERE a.entity_type = ?" : "";
  const params: unknown[] = entityType ? [entityType] : [];

  const countRow = await db
    .prepare(`SELECT COUNT(*) AS count FROM audit_logs a${clause}`)
    .bind(...params)
    .first<{ count: number }>();

  const { results } = await db
    .prepare(
      `SELECT a.*, u.email AS email FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id${clause}
       ORDER BY a.created_at DESC LIMIT ? OFFSET ?`
    )
    .bind(...params, pageSize, (page - 1) * pageSize)
    .all<AuditLogRow>();

  return { items: results, total: countRow?.count ?? 0 };
}
