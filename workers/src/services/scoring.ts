import { CRITERION_WEIGHTS, DISAGREEMENT_THRESHOLD } from "../config/rubric";
import { fmean, pstdev, pyRound } from "../lib/stats";
import { nowIso } from "../lib/time";

export interface SubmissionScoreRow {
  submission_id: string;
  overall_score: number | null;
  criterion_means: string;
  highest_score: number | null;
  lowest_score: number | null;
  std_dev: number | null;
  reviews_completed: number;
  is_flagged: number;
  computed_at: string;
}

/**
 * Weighted overall for one judge. Only criteria that exist in the configured rubric and have
 * a non-null score contribute; weights are percentages. Returns null when nothing qualifies.
 * A score whose criterion has since been removed from the config is therefore ignored, which
 * is the same behaviour the old ACTIVE-rubric lookup had.
 */
function weightedOverall(
  scoresByCriterion: Map<number, number>,
  weightByCriterion: ReadonlyMap<number, number>
): number | null {
  let total = 0;
  let matched = 0;
  for (const [criterionId, score] of scoresByCriterion) {
    const weight = weightByCriterion.get(criterionId);
    if (weight === undefined) continue;
    total += score * (weight / 100);
    matched += 1;
  }
  return matched === 0 ? null : total;
}

/**
 * How many completed evaluations contribute to a submission's score.
 *
 * There is no assignment step, so any judge may review any submission and a popular one can
 * collect far more reviews than a neglected one. Counting all of them would make the score
 * depend on how much attention a submission happened to attract. Only the first five to be
 * COMPLETED count; later ones are still recorded and shown, but do not move the score.
 */
export const SCORING_EVALUATION_LIMIT = 5;

/**
 * The completed evaluations that count toward the score, oldest completion first.
 *
 * `completed_at` is the ordering key rather than `started_at`, so a judge who opens a
 * submission and abandons it never occupies one of the five slots. `id` breaks ties for two
 * completions in the same millisecond, making the selection deterministic.
 */
export async function countedEvaluationIds(
  db: D1Database,
  submissionId: string
): Promise<number[]> {
  const { results } = await db
    .prepare(
      `SELECT id FROM evaluations
       WHERE submission_id = ? AND status = 'completed'
       ORDER BY completed_at ASC, id ASC
       LIMIT ?`
    )
    .bind(submissionId, SCORING_EVALUATION_LIMIT)
    .all<{ id: number }>();
  return results.map((r) => r.id);
}

/**
 * Recomputes the materialized aggregate for a submission, ported from
 * backend/app/services/scoring_service.py. Runs synchronously whenever an evaluation is
 * completed or edited, exactly as before.
 *
 * Every completed evaluation gets its own `weighted_overall_score` written, including ones
 * beyond the limit -- an admin still needs to see what the sixth judge thought. Only the
 * counted ones feed the submission aggregate.
 */
export async function recomputeSubmissionScore(
  db: D1Database,
  submissionId: string
): Promise<void> {
  const weightByCriterion = CRITERION_WEIGHTS;
  const threshold = DISAGREEMENT_THRESHOLD;

  const { results: completed } = await db
    .prepare(
      `SELECT id FROM evaluations
       WHERE submission_id = ? AND status = 'completed'
       ORDER BY completed_at ASC, id ASC`
    )
    .bind(submissionId)
    .all<{ id: number }>();

  // The same ordering as countedEvaluationIds, so "the first five" means the same thing in
  // both places without a second query.
  const counted = new Set(completed.slice(0, SCORING_EVALUATION_LIMIT).map((r) => r.id));

  const perJudgeOverall: number[] = [];
  const perCriterionValues = new Map<number, number[]>();

  for (const { id } of completed) {
    const { results: scores } = await db
      .prepare("SELECT criterion_id, score FROM evaluation_scores WHERE evaluation_id = ?")
      .bind(id)
      .all<{ criterion_id: number; score: number | null }>();

    const scoresByCriterion = new Map<number, number>();
    for (const s of scores) {
      if (s.score !== null) scoresByCriterion.set(s.criterion_id, s.score);
    }
    const overall = weightedOverall(scoresByCriterion, weightByCriterion);
    // Written for every completed evaluation, counted or not: this is the judge's own score.
    await db
      .prepare("UPDATE evaluations SET weighted_overall_score = ? WHERE id = ?")
      .bind(overall === null ? null : pyRound(overall, 3), id)
      .run();

    if (!counted.has(id)) continue;

    for (const [criterionId, value] of scoresByCriterion) {
      const list = perCriterionValues.get(criterionId) ?? [];
      list.push(value);
      perCriterionValues.set(criterionId, list);
    }
    if (overall !== null) perJudgeOverall.push(overall);
  }

  const criterionMeans: Record<string, number> = {};
  for (const [criterionId, values] of perCriterionValues) {
    criterionMeans[String(criterionId)] = pyRound(fmean(values), 3);
  }

  let overallScore: number | null = null;
  let highest: number | null = null;
  let lowest: number | null = null;
  let stdDev: number | null = null;
  let isFlagged = false;

  if (perJudgeOverall.length > 0) {
    overallScore = pyRound(fmean(perJudgeOverall), 3);
    highest = pyRound(Math.max(...perJudgeOverall), 3);
    lowest = pyRound(Math.min(...perJudgeOverall), 3);
    // A single completed review has zero spread, reported as 0.0 rather than null.
    stdDev = perJudgeOverall.length > 1 ? pyRound(pstdev(perJudgeOverall), 3) : 0.0;
    isFlagged = stdDev !== null && stdDev > threshold;
  }

  await db
    .prepare(
      `INSERT INTO submission_scores
         (submission_id, overall_score, criterion_means, highest_score, lowest_score,
          std_dev, reviews_completed, is_flagged, computed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(submission_id) DO UPDATE SET
         overall_score = excluded.overall_score,
         criterion_means = excluded.criterion_means,
         highest_score = excluded.highest_score,
         lowest_score = excluded.lowest_score,
         std_dev = excluded.std_dev,
         reviews_completed = excluded.reviews_completed,
         is_flagged = excluded.is_flagged,
         computed_at = excluded.computed_at`
    )
    .bind(
      submissionId,
      overallScore,
      JSON.stringify(criterionMeans),
      highest,
      lowest,
      stdDev,
      // The number BEHIND the score, not the number of reviews received. Reporting 7 next to
      // an average computed from 5 would misdescribe the figure it sits beside; the full list
      // of reviews is on the submission detail page.
      counted.size,
      isFlagged ? 1 : 0,
      nowIso()
    )
    .run();
}
