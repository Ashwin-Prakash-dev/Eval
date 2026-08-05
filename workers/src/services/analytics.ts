import { fmean, pyRound } from "../lib/stats";
import * as rubricRepo from "../repo/rubric";

/** Ported from backend/app/services/analytics_service.py. */
const SCORE_BUCKETS: [number, number][] = [
  [1, 2],
  [2, 4],
  [4, 6],
  [6, 8],
  [8, 10.0001],
];

export interface LeaderboardEntry {
  rank: number;
  submission_id: number;
  project_title: string;
  problem_statement: string | null;
  overall_score: number | null;
  criterion_scores: Record<string, number>;
  std_dev: number | null;
  reviews_completed: number;
  is_flagged: boolean;
}

interface LeaderboardRow {
  id: number;
  project_title: string;
  problem_statement_id: number | null;
  ps_title: string | null;
  overall_score: number | null;
  criterion_means: string | null;
  std_dev: number | null;
  reviews_completed: number | null;
  is_flagged: number | null;
}

export async function getDashboardStats(db: D1Database) {
  const row = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM submissions) AS total_submissions,
         (SELECT COUNT(*) FROM users WHERE role = 'judge') AS total_judges,
         (SELECT COUNT(*) FROM assignments) AS total_reviews,
         (SELECT COUNT(*) FROM evaluations WHERE status = 'completed') AS completed_reviews,
         (SELECT AVG(overall_score) FROM submission_scores) AS average_score`
    )
    .first<{
      total_submissions: number;
      total_judges: number;
      total_reviews: number;
      completed_reviews: number;
      average_score: number | null;
    }>();

  const stats = row ?? {
    total_submissions: 0,
    total_judges: 0,
    total_reviews: 0,
    completed_reviews: 0,
    average_score: null,
  };

  return {
    total_submissions: stats.total_submissions,
    total_judges: stats.total_judges,
    total_reviews: stats.total_reviews,
    completed_reviews: stats.completed_reviews,
    pending_reviews: Math.max(stats.total_reviews - stats.completed_reviews, 0),
    average_score: stats.average_score === null ? null : pyRound(stats.average_score, 3),
  };
}

export async function getSubmissionDistribution(db: D1Database) {
  const { results } = await db
    .prepare(
      `SELECT p.title AS title, COUNT(s.id) AS count
       FROM problem_statements p
       JOIN submissions s ON s.problem_statement_id = p.id
       GROUP BY p.title ORDER BY p.title`
    )
    .all<{ title: string; count: number }>();

  const points = results.map((r) => ({ problem_statement: r.title, count: r.count }));

  const unassigned = await db
    .prepare("SELECT COUNT(*) AS count FROM submissions WHERE problem_statement_id IS NULL")
    .first<{ count: number }>();
  if (unassigned && unassigned.count) {
    points.push({ problem_statement: "Unassigned", count: unassigned.count });
  }
  return points;
}

export async function getJudgeProgress(db: D1Database) {
  const { results: judges } = await db
    .prepare("SELECT id, email, full_name FROM users WHERE role = 'judge' ORDER BY email")
    .all<{ id: number; email: string; full_name: string | null }>();

  const points = [];
  for (const judge of judges) {
    const row = await db
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM assignments WHERE judge_id = ?1) AS total,
           (SELECT COUNT(*) FROM evaluations WHERE judge_id = ?1 AND status = 'completed') AS completed`
      )
      .bind(judge.id)
      .first<{ total: number; completed: number }>();
    const total = row?.total ?? 0;
    const completed = row?.completed ?? 0;
    points.push({
      judge_id: judge.id,
      judge_name: judge.full_name || judge.email,
      completed,
      pending: Math.max(total - completed, 0),
      total,
    });
  }
  return points;
}

export async function getScoreDistribution(db: D1Database) {
  const { results } = await db
    .prepare("SELECT overall_score FROM submission_scores WHERE overall_score IS NOT NULL")
    .all<{ overall_score: number }>();
  const scores = results.map((r) => r.overall_score);

  return SCORE_BUCKETS.map(([low, high]) => ({
    range_label: `${formatBucket(low)}-${formatBucket(Math.min(high, 10))}`,
    count: scores.filter((s) => low <= s && s < high).length,
  }));
}

/** Python's %g drops a trailing ".0", so 10.0 renders as "10". */
function formatBucket(value: number): string {
  return String(Number(value.toPrecision(6)));
}

export async function getCriterionAverages(db: D1Database) {
  const rubric = await rubricRepo.getActive(db);
  if (!rubric) return [];

  const { results } = await db
    .prepare("SELECT criterion_means FROM submission_scores")
    .all<{ criterion_means: string | null }>();
  const allMeans = results.map((r) => parseMeans(r.criterion_means));

  return rubric.criteria.map((criterion) => {
    const key = String(criterion.id);
    const values = allMeans
      .filter((m): m is Record<string, number> => m !== null && Object.prototype.hasOwnProperty.call(m, key))
      .map((m) => m[key]!);
    return {
      criterion_id: criterion.id,
      criterion_name: criterion.name,
      average_score: values.length ? pyRound(fmean(values), 3) : 0.0,
    };
  });
}

function parseMeans(raw: string | null): Record<string, number> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return null;
  }
}

export async function getLeaderboard(
  db: D1Database,
  options: {
    search?: string;
    problem_statement_id?: number;
    sort_by?: string;
    sort_dir?: string;
    page?: number;
    page_size?: number;
  } = {}
): Promise<{ entries: LeaderboardEntry[]; total: number }> {
  const sortBy = options.sort_by ?? "overall_score";
  const sortDir = options.sort_dir ?? "desc";
  const page = options.page ?? 1;
  const pageSize = options.page_size ?? 25;

  const rubric = await rubricRepo.getActive(db);
  const criterionNames = new Map<number, string>(
    (rubric?.criteria ?? []).map((c) => [c.id, c.name])
  );

  const where: string[] = [];
  const params: unknown[] = [];
  if (options.search) {
    where.push("s.project_title LIKE ?");
    params.push(`%${options.search}%`);
  }
  if (options.problem_statement_id) {
    where.push("s.problem_statement_id = ?");
    params.push(options.problem_statement_id);
  }
  const clause = where.length ? ` WHERE ${where.join(" AND ")}` : "";

  const { results } = await db
    .prepare(
      `SELECT s.id, s.project_title, s.problem_statement_id,
              p.title AS ps_title,
              sc.overall_score, sc.criterion_means, sc.std_dev,
              sc.reviews_completed, sc.is_flagged
       FROM submissions s
       LEFT JOIN problem_statements p ON p.id = s.problem_statement_id
       LEFT JOIN submission_scores sc ON sc.submission_id = s.id${clause}`
    )
    .bind(...params)
    .all<LeaderboardRow>();

  const rows = [...results];
  const total = rows.length;

  // Sorting mirrors the Python implementation: missing numeric values sort as -1, and
  // project_title sorts case-insensitively ascending then reverses for desc.
  const key = (r: LeaderboardRow): number | string => {
    if (sortBy === "std_dev") return r.std_dev ?? -1;
    if (sortBy === "reviews_completed") return r.reviews_completed ?? 0;
    if (sortBy === "project_title") return r.project_title.toLowerCase();
    return r.overall_score ?? -1;
  };

  if (sortBy === "project_title") {
    rows.sort((a, b) => String(key(a)).localeCompare(String(key(b))));
    if (sortDir === "desc") rows.reverse();
  } else {
    rows.sort((a, b) => (key(a) as number) - (key(b) as number));
    if (sortDir === "desc") rows.reverse();
  }

  const start = (page - 1) * pageSize;
  const pageItems = rows.slice(start, start + pageSize);

  const entries = pageItems.map((row, index) => {
    const means = parseMeans(row.criterion_means);
    const criterionScores: Record<string, number> = {};
    if (means) {
      for (const [cid, value] of Object.entries(means)) {
        criterionScores[criterionNames.get(Number(cid)) ?? `Criterion ${cid}`] = value;
      }
    }
    return {
      rank: start + index + 1,
      submission_id: row.id,
      project_title: row.project_title,
      problem_statement: row.ps_title,
      overall_score: row.overall_score,
      criterion_scores: criterionScores,
      std_dev: row.std_dev,
      reviews_completed: row.reviews_completed ?? 0,
      is_flagged: row.is_flagged === 1,
    };
  });

  return { entries, total };
}

export async function getOverview(db: D1Database) {
  const { entries } = await getLeaderboard(db, { page: 1, page_size: 5 });
  return {
    stats: await getDashboardStats(db),
    submission_distribution: await getSubmissionDistribution(db),
    judge_progress: await getJudgeProgress(db),
    score_distribution: await getScoreDistribution(db),
    criterion_averages: await getCriterionAverages(db),
    leaderboard_preview: entries,
  };
}
