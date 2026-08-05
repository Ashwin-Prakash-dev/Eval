import { nowIso } from "../lib/time";
import type { CriterionInput } from "../schemas/rubric";

export interface RubricRow {
  id: number;
  name: string;
  is_active: number;
  disagreement_threshold: number;
  created_at: string;
}

export interface CriterionRow {
  id: number;
  rubric_id: number;
  name: string;
  description: string;
  weight: number;
  order_index: number;
}

export interface Rubric {
  id: number;
  name: string;
  is_active: boolean;
  disagreement_threshold: number;
  created_at: string;
  criteria: CriterionRow[];
}

function toRubric(row: RubricRow, criteria: CriterionRow[]): Rubric {
  return {
    id: row.id,
    name: row.name,
    is_active: row.is_active === 1,
    disagreement_threshold: row.disagreement_threshold,
    created_at: row.created_at,
    criteria,
  };
}

/** Criteria are always ordered by order_index, matching the relationship's order_by. */
async function criteriaFor(db: D1Database, rubricIds: number[]): Promise<Map<number, CriterionRow[]>> {
  const map = new Map<number, CriterionRow[]>();
  if (rubricIds.length === 0) return map;
  const placeholders = rubricIds.map(() => "?").join(", ");
  const { results } = await db
    .prepare(
      `SELECT * FROM evaluation_criteria WHERE rubric_id IN (${placeholders}) ORDER BY order_index, id`
    )
    .bind(...rubricIds)
    .all<CriterionRow>();
  for (const row of results) {
    const list = map.get(row.rubric_id) ?? [];
    list.push(row);
    map.set(row.rubric_id, list);
  }
  return map;
}

export async function get(db: D1Database, rubricId: number): Promise<Rubric | null> {
  const row = await db.prepare("SELECT * FROM rubrics WHERE id = ?").bind(rubricId).first<RubricRow>();
  if (!row) return null;
  const criteria = await criteriaFor(db, [row.id]);
  return toRubric(row, criteria.get(row.id) ?? []);
}

export async function listAll(db: D1Database): Promise<Rubric[]> {
  const { results } = await db
    .prepare("SELECT * FROM rubrics ORDER BY created_at DESC")
    .all<RubricRow>();
  const criteria = await criteriaFor(db, results.map((r) => r.id));
  return results.map((row) => toRubric(row, criteria.get(row.id) ?? []));
}

export async function getActive(db: D1Database): Promise<Rubric | null> {
  const row = await db.prepare("SELECT * FROM rubrics WHERE is_active = 1").first<RubricRow>();
  if (!row) return null;
  const criteria = await criteriaFor(db, [row.id]);
  return toRubric(row, criteria.get(row.id) ?? []);
}

export async function create(
  db: D1Database,
  data: { name: string; disagreement_threshold: number; criteria: CriterionInput[] }
): Promise<Rubric> {
  const row = await db
    .prepare(
      "INSERT INTO rubrics (name, disagreement_threshold, is_active, created_at) VALUES (?, ?, 0, ?) RETURNING id"
    )
    .bind(data.name, data.disagreement_threshold, nowIso())
    .first<{ id: number }>();
  if (!row) throw new Error("Failed to create rubric");

  await insertCriteria(db, row.id, data.criteria);
  const created = await get(db, row.id);
  if (!created) throw new Error("Failed to read back created rubric");
  return created;
}

async function insertCriteria(
  db: D1Database,
  rubricId: number,
  criteria: CriterionInput[]
): Promise<void> {
  if (criteria.length === 0) return;
  await db.batch(
    criteria.map((c) =>
      db
        .prepare(
          "INSERT INTO evaluation_criteria (rubric_id, name, description, weight, order_index) VALUES (?, ?, ?, ?, ?)"
        )
        .bind(rubricId, c.name, c.description, c.weight, c.order_index)
    )
  );
}

/**
 * Replacing criteria deletes the old rows and inserts new ones, exactly as the SQLAlchemy
 * version did. Their evaluation_scores cascade away with them — same as before, since the
 * criterion FK was already ON DELETE CASCADE.
 */
export async function update(
  db: D1Database,
  rubricId: number,
  patch: { name?: string; disagreement_threshold?: number; is_active?: boolean },
  criteria?: CriterionInput[]
): Promise<Rubric | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  if (patch.name !== undefined) {
    sets.push("name = ?");
    values.push(patch.name);
  }
  if (patch.disagreement_threshold !== undefined) {
    sets.push("disagreement_threshold = ?");
    values.push(patch.disagreement_threshold);
  }
  if (patch.is_active !== undefined) {
    sets.push("is_active = ?");
    values.push(patch.is_active ? 1 : 0);
  }
  if (sets.length > 0) {
    values.push(rubricId);
    await db.prepare(`UPDATE rubrics SET ${sets.join(", ")} WHERE id = ?`).bind(...values).run();
  }

  if (criteria !== undefined) {
    await db.prepare("DELETE FROM evaluation_criteria WHERE rubric_id = ?").bind(rubricId).run();
    await insertCriteria(db, rubricId, criteria);
  }
  return get(db, rubricId);
}

/** Exactly one rubric is active; D1 has no interactive transaction so both writes batch. */
export async function activate(db: D1Database, rubricId: number): Promise<Rubric | null> {
  await db.batch([
    db.prepare("UPDATE rubrics SET is_active = 0 WHERE id != ?").bind(rubricId),
    db.prepare("UPDATE rubrics SET is_active = 1 WHERE id = ?").bind(rubricId),
  ]);
  return get(db, rubricId);
}

export async function remove(db: D1Database, rubricId: number): Promise<void> {
  await db.prepare("DELETE FROM rubrics WHERE id = ?").bind(rubricId).run();
}
