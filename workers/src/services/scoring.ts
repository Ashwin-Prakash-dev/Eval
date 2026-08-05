import { fmean, pstdev, pyRound } from "../lib/stats";
import { nowIso } from "../lib/time";
import * as rubricRepo from "../repo/rubric";

export interface SubmissionScoreRow {
  submission_id: number;
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
 * Weighted overall for one judge. Only criteria that exist in the ACTIVE rubric and have a
 * non-null score contribute; weights are percentages. Returns null when nothing qualifies.
 */
function weightedOverall(
  scoresByCriterion: Map<number, number>,
  weightByCriterion: Map<number, number>
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
 * Recomputes the materialized aggregate for a submission, ported from
 * backend/app/services/scoring_service.py. Runs synchronously whenever an evaluation is
 * completed or edited, exactly as before.
 */
export async function recomputeSubmissionScore(
  db: D1Database,
  submissionId: number
): Promise<void> {
  const rubric = await rubricRepo.getActive(db);
  const weightByCriterion = new Map<number, number>(
    (rubric?.criteria ?? []).map((c) => [c.id, c.weight])
  );
  const threshold = rubric?.disagreement_threshold ?? 1.5;

  const { results: completed } = await db
    .prepare("SELECT id FROM evaluations WHERE submission_id = ? AND status = 'completed'")
    .bind(submissionId)
    .all<{ id: number }>();

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
    for (const [criterionId, value] of scoresByCriterion) {
      const list = perCriterionValues.get(criterionId) ?? [];
      list.push(value);
      perCriterionValues.set(criterionId, list);
    }

    const overall = weightedOverall(scoresByCriterion, weightByCriterion);
    await db
      .prepare("UPDATE evaluations SET weighted_overall_score = ? WHERE id = ?")
      .bind(overall === null ? null : pyRound(overall, 3), id)
      .run();
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
      completed.length,
      isFlagged ? 1 : 0,
      nowIso()
    )
    .run();
}
