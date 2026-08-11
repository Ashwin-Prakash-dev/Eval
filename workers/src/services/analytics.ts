import { CRITERIA_ORDERED, CRITERION_NAMES } from "../config/rubric";
import { fmean, pyRound } from "../lib/stats";
import * as applicationRepo from "../repo/application";
import * as evaluationRepo from "../repo/evaluation";
import { SCORING_EVALUATION_LIMIT } from "./scoring";

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
  submission_id: string;
  project_title: string;
  overall_score: number | null;
  criterion_scores: Record<string, number>;
  std_dev: number | null;
  reviews_completed: number;
  is_flagged: boolean;
}

interface LeaderboardRow {
  id: string;
  project_title: string;
  overall_score: number | null;
  criterion_means: string | null;
  std_dev: number | null;
  reviews_completed: number | null;
  is_flagged: number | null;
}

export async function getDashboardStats(db: D1Database, eventsDb: D1Database) {
  // total_submissions counts startathon applications, which live in the other database and
  // therefore cannot be a subquery here.
  const totalSubmissions = await applicationRepo.count(eventsDb);
  const row = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM users WHERE role = 'judge') AS total_judges,
         (SELECT COUNT(*) FROM evaluations) AS total_reviews,
         (SELECT COUNT(*) FROM evaluations WHERE status = 'completed') AS completed_reviews,
         (SELECT AVG(overall_score) FROM submission_scores) AS average_score`
    )
    .first<{
      total_judges: number;
      total_reviews: number;
      completed_reviews: number;
      average_score: number | null;
    }>();

  const stats = row ?? {
    total_judges: 0,
    total_reviews: 0,
    completed_reviews: 0,
    average_score: null,
  };

  return {
    total_submissions: totalSubmissions,
    total_judges: stats.total_judges,
    total_reviews: stats.total_reviews,
    completed_reviews: stats.completed_reviews,
    pending_reviews: Math.max(stats.total_reviews - stats.completed_reviews, 0),
    average_score: stats.average_score === null ? null : pyRound(stats.average_score, 3),
  };
}

/**
 * Judge progress is now measured against the whole field rather than an allocation: with
 * assignments gone, "pending" means submissions this judge has not yet completed, not work
 * someone handed them.
 */
export async function getJudgeProgress(db: D1Database, eventsDb: D1Database) {
  const { results: judges } = await db
    .prepare("SELECT id, email, full_name FROM users WHERE role = 'judge' ORDER BY email")
    .all<{ id: number; email: string; full_name: string | null }>();

  const total = await applicationRepo.count(eventsDb);

  const points = [];
  for (const judge of judges) {
    const row = await db
      .prepare(
        "SELECT COUNT(*) AS completed FROM evaluations WHERE judge_id = ? AND status = 'completed'"
      )
      .bind(judge.id)
      .first<{ completed: number }>();
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
  const { results } = await db
    .prepare("SELECT criterion_means FROM submission_scores")
    .all<{ criterion_means: string | null }>();
  const allMeans = results.map((r) => parseMeans(r.criterion_means));

  return CRITERIA_ORDERED.map((criterion) => {
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
  eventsDb: D1Database,
  options: {
    search?: string;
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

  const criterionNames = CRITERION_NAMES;

  // Submissions and their scores live in different D1 databases, so the old single-query
  // LEFT JOIN becomes two reads merged here. Sorting and pagination were already done in
  // application code, so only the join and the title filter moved.
  const applications = await applicationRepo.listAll(eventsDb);
  const term = options.search?.toLowerCase();
  const filtered = term
    ? applications.filter((a) => a.title.toLowerCase().includes(term))
    : applications;

  const { results: scoreRows } = await db
    .prepare(
      `SELECT submission_id, overall_score, criterion_means, std_dev,
              reviews_completed, is_flagged
       FROM submission_scores`
    )
    .all<{
      submission_id: string;
      overall_score: number | null;
      criterion_means: string | null;
      std_dev: number | null;
      reviews_completed: number | null;
      is_flagged: number | null;
    }>();
  const scoreById = new Map(scoreRows.map((r) => [r.submission_id, r]));

  const rows: LeaderboardRow[] = filtered.map((a) => {
    const score = scoreById.get(a.team_id);
    return {
      id: a.team_id,
      project_title: a.title,
      overall_score: score?.overall_score ?? null,
      criterion_means: score?.criterion_means ?? null,
      std_dev: score?.std_dev ?? null,
      reviews_completed: score?.reviews_completed ?? null,
      is_flagged: score?.is_flagged ?? null,
    };
  });
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
      overall_score: row.overall_score,
      criterion_scores: criterionScores,
      std_dev: row.std_dev,
      reviews_completed: row.reviews_completed ?? 0,
      is_flagged: row.is_flagged === 1,
    };
  });

  return { entries, total };
}

/**
 * Review coverage: how many completed reviews each submission has, and how the field is
 * distributed across the buckets that matter.
 *
 * This exists because dropping assignments removed the guarantee that every submission gets
 * reviewed. Coverage used to be produced by allocation; now it is emergent, and this is the
 * only thing that answers "is every submission going to be scored?".
 *
 * Buckets are cut around SCORING_EVALUATION_LIMIT rather than evenly: the meaningful
 * question is not "how many reviews" but "is it scored yet, and if not how far off".
 */
export async function getCoverage(db: D1Database, eventsDb: D1Database) {
  const applications = await applicationRepo.listAll(eventsDb);
  const completedCounts = await evaluationRepo.completedCountsBySubmission(db);

  const submissions = applications
    .map((application) => {
      const completed = completedCounts.get(application.team_id) ?? 0;
      return {
        id: application.team_id,
        project_title: application.title,
        team_identifier: application.team_name,
        completed_reviews: completed,
        needed: Math.max(SCORING_EVALUATION_LIMIT - completed, 0),
        is_scored: completed >= SCORING_EVALUATION_LIMIT,
      };
    })
    // Neediest first: this list is a worklist, not a catalogue.
    .sort((a, b) => a.completed_reviews - b.completed_reviews || a.project_title.localeCompare(b.project_title));

  const inRange = (n: number, min: number, max: number) => n >= min && n <= max;
  const buckets = [
    { label: "No reviews", min: 0, max: 0 },
    { label: "1-2", min: 1, max: 2 },
    { label: "3-4", min: 3, max: 4 },
    { label: `${SCORING_EVALUATION_LIMIT}+ (scored)`, min: SCORING_EVALUATION_LIMIT, max: Infinity },
  ].map((bucket) => ({
    label: bucket.label,
    count: submissions.filter((s) => inRange(s.completed_reviews, bucket.min, bucket.max)).length,
  }));

  return {
    scoring_limit: SCORING_EVALUATION_LIMIT,
    total_submissions: submissions.length,
    fully_scored: submissions.filter((s) => s.is_scored).length,
    unreviewed: submissions.filter((s) => s.completed_reviews === 0).length,
    buckets,
    submissions,
  };
}

export async function getOverview(db: D1Database, eventsDb: D1Database) {
  const { entries } = await getLeaderboard(db, eventsDb, { page: 1, page_size: 5 });
  return {
    stats: await getDashboardStats(db, eventsDb),
    coverage: await getCoverage(db, eventsDb),
    judge_progress: await getJudgeProgress(db, eventsDb),
    score_distribution: await getScoreDistribution(db),
    criterion_averages: await getCriterionAverages(db),
    leaderboard_preview: entries,
  };
}
