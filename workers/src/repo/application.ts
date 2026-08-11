/**
 * Submissions, read from the startathon system.
 *
 * `startathon_applications` IS the submissions table. It lives in EVENTS_DB, owned by
 * scc-api-worker, and is strictly read-only from here -- this app never writes to it.
 * `startathon_teams` is in the same database, so joining it for the team name is a normal
 * SQL join and costs nothing.
 *
 * Everything else in this app (assignments, evaluations, scores) lives in the eval database
 * and keys off `team_id`. D1 has no cross-database joins, so any query that needs both sides
 * is two queries plus a merge in application code -- see `byIds`, which exists for exactly
 * that and is the reason callers can tolerate a team that has since been deleted.
 *
 * A row exists here only for a team that already passed `unconfirmedTeamBlock` on the
 * startathon side, so the row's existence is the eligibility signal: no status filter needed.
 */

/** Timestamps on the startathon side are epoch integers, not the ISO strings eval uses. */
export interface ApplicationRow {
  team_id: string;
  title: string;
  summary: string;
  problem_evidence: string;
  deck_url: string;
  video_url: string;
  prior_work: string | null;
  domains: string | null;
  created_at: number;
  updated_at: number | null;
  team_name: string;
}

const SELECT_APPLICATIONS = `
  SELECT a.team_id, a.title, a.summary, a.problem_evidence, a.deck_url, a.video_url,
         a.prior_work, a.domains, a.created_at, a.updated_at,
         t.team_name AS team_name
  FROM startathon_applications a
  JOIN startathon_teams t ON t.team_id = a.team_id
`;

export async function get(
  eventsDb: D1Database,
  teamId: string
): Promise<ApplicationRow | null> {
  return eventsDb
    .prepare(`${SELECT_APPLICATIONS} WHERE a.team_id = ?`)
    .bind(teamId)
    .first<ApplicationRow>();
}

export async function listPaginated(
  eventsDb: D1Database,
  page: number,
  pageSize: number,
  search?: string | null
): Promise<{ items: ApplicationRow[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];

  if (search) {
    where.push("(a.title LIKE ? OR t.team_name LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }
  const clause = where.length ? ` WHERE ${where.join(" AND ")}` : "";

  const countRow = await eventsDb
    .prepare(
      `SELECT COUNT(*) AS count
       FROM startathon_applications a
       JOIN startathon_teams t ON t.team_id = a.team_id${clause}`
    )
    .bind(...params)
    .first<{ count: number }>();

  const { results } = await eventsDb
    .prepare(`${SELECT_APPLICATIONS}${clause} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`)
    .bind(...params, pageSize, (page - 1) * pageSize)
    .all<ApplicationRow>();

  return { items: results, total: countRow?.count ?? 0 };
}

/** Every application, used by the leaderboard and the assignment generator. */
export async function listAll(eventsDb: D1Database): Promise<ApplicationRow[]> {
  const { results } = await eventsDb
    .prepare(`${SELECT_APPLICATIONS} ORDER BY a.created_at DESC`)
    .all<ApplicationRow>();
  return results;
}

export async function count(eventsDb: D1Database): Promise<number> {
  const row = await eventsDb
    .prepare("SELECT COUNT(*) AS count FROM startathon_applications")
    .first<{ count: number }>();
  return row?.count ?? 0;
}

/**
 * Bulk lookup keyed by team_id, replacing the `JOIN submissions` that assignment and
 * leaderboard queries used before the split. A requested id that is absent simply has no
 * entry: with the foreign keys gone, an assignment can outlive the team it points at, and
 * callers must decide what to show rather than assuming a row exists.
 *
 * D1 caps bound parameters per statement, so ids are chunked rather than sent as one IN list.
 */
export async function byIds(
  eventsDb: D1Database,
  teamIds: string[]
): Promise<Map<string, ApplicationRow>> {
  const map = new Map<string, ApplicationRow>();
  const unique = [...new Set(teamIds)];
  if (unique.length === 0) return map;

  const CHUNK = 90;
  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK);
    const placeholders = chunk.map(() => "?").join(", ");
    const { results } = await eventsDb
      .prepare(`${SELECT_APPLICATIONS} WHERE a.team_id IN (${placeholders})`)
      .bind(...chunk)
      .all<ApplicationRow>();
    for (const row of results) map.set(row.team_id, row);
  }
  return map;
}
