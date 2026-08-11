import { CRITERION_WEIGHTS } from "../config/rubric";
import type { User } from "../db";
import { fmean, pstdev, pyRound } from "../lib/stats";

export interface JudgeStats {
  judge: User;
  /** Reviews this judge has opened. There is no allocation any more, so nothing is "assigned". */
  reviews_started: number;
  reviews_completed: number;
  reviews_pending: number;
  average_score_given: number | null;
  std_dev_given: number | null;
  average_review_time_seconds: number | null;
  is_harsh: boolean;
  is_lenient: boolean;
  is_high_variance: boolean;
}

/**
 * Ported from scoring_service.compute_judge_stats. A judge is flagged harsh/lenient when
 * their mean sits more than max(population stdev, 0.5) from the population mean — the 0.5
 * floor keeps a tightly-clustered panel from flagging everyone.
 */
export async function computeJudgeStats(
  db: D1Database,
  judges: User[]
): Promise<JudgeStats[]> {
  const weightByCriterion = CRITERION_WEIGHTS;

  interface Raw {
    judge: User;
    assigned: number;
    completed: number;
    pending: number;
    avgScore: number | null;
    stdDev: number | null;
    avgTime: number | null;
  }
  const raw: Raw[] = [];
  const perJudgeAvg: number[] = [];
  const perJudgeStd: number[] = [];

  for (const judge of judges) {
    const { results: evaluations } = await db
      .prepare("SELECT id, status, time_spent_seconds FROM evaluations WHERE judge_id = ?")
      .bind(judge.id)
      .all<{ id: number; status: string; time_spent_seconds: number }>();

    const assigned = evaluations.length;
    const completedEvals = evaluations.filter((e) => e.status === "completed");
    const completed = completedEvals.length;

    const overalls: number[] = [];
    const reviewTimes: number[] = [];

    for (const evaluation of completedEvals) {
      const { results: scores } = await db
        .prepare("SELECT criterion_id, score FROM evaluation_scores WHERE evaluation_id = ?")
        .bind(evaluation.id)
        .all<{ criterion_id: number; score: number | null }>();

      let total = 0;
      let matched = 0;
      for (const s of scores) {
        if (s.score === null) continue;
        const weight = weightByCriterion.get(s.criterion_id);
        if (weight === undefined) continue;
        total += s.score * (weight / 100);
        matched += 1;
      }
      if (matched > 0) overalls.push(total);
      if (evaluation.time_spent_seconds) reviewTimes.push(evaluation.time_spent_seconds);
    }

    const avgScore = overalls.length ? pyRound(fmean(overalls), 3) : null;
    const stdDev = overalls.length > 1 ? pyRound(pstdev(overalls), 3) : overalls.length ? 0.0 : null;
    const avgTime = reviewTimes.length ? pyRound(fmean(reviewTimes), 1) : null;

    if (avgScore !== null) perJudgeAvg.push(avgScore);
    if (stdDev !== null) perJudgeStd.push(stdDev);

    raw.push({
      judge,
      assigned,
      completed,
      pending: assigned - completed,
      avgScore,
      stdDev,
      avgTime,
    });
  }

  const populationMean = perJudgeAvg.length ? fmean(perJudgeAvg) : null;
  const populationStd = perJudgeAvg.length > 1 ? pstdev(perJudgeAvg) : 0.0;
  const stdsMean = perJudgeStd.length ? fmean(perJudgeStd) : null;
  const stdsStd = perJudgeStd.length > 1 ? pstdev(perJudgeStd) : 0.0;

  return raw.map((entry) => ({
    judge: entry.judge,
    reviews_started: entry.assigned,
    reviews_completed: entry.completed,
    reviews_pending: entry.pending,
    average_score_given: entry.avgScore,
    std_dev_given: entry.stdDev,
    average_review_time_seconds: entry.avgTime,
    is_harsh:
      entry.avgScore !== null &&
      populationMean !== null &&
      entry.avgScore < populationMean - Math.max(populationStd, 0.5),
    is_lenient:
      entry.avgScore !== null &&
      populationMean !== null &&
      entry.avgScore > populationMean + Math.max(populationStd, 0.5),
    is_high_variance:
      entry.stdDev !== null &&
      stdsMean !== null &&
      entry.stdDev > stdsMean + Math.max(stdsStd, 0.5),
  }));
}
