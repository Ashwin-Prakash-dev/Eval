import { nowIso } from "../lib/time";

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
