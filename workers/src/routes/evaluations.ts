import { Hono } from "hono";

import { CRITERIA_ORDERED } from "../config/rubric";
import { notFound } from "../http";
import { nowIso } from "../lib/time";
import { intPathParam, parseOrThrow, readJson } from "../lib/validate";
import { requireAdmin, requireReviewer, requireUser, type AppEnv } from "../middleware/auth";
import * as applicationRepo from "../repo/application";
import * as evaluationRepo from "../repo/evaluation";
import { evaluationAutosaveSchema, evaluationFlagSchema } from "../schemas/evaluation";
import { submissionJudgeOut } from "../serializers/submission";
import {
  countedEvaluationIds,
  recomputeSubmissionScore,
  SCORING_EVALUATION_LIMIT,
} from "../services/scoring";

/**
 * The reviewer's own view of their evaluation -- a judge or an admin, since organisers judge
 * too and both hit these routes through requireReviewer.
 *
 * `flagged_for_review` appears here and NOWHERE else: it is a private bookmark, so it must
 * not reach another reviewer or the admin cross-reviewer view. See adminEvaluationOut, which
 * omits it.
 */
function evaluationOut(e: evaluationRepo.EvaluationWithDetail) {
  return {
    id: e.id,
    submission_id: e.submission_id,
    status: e.status,
    weighted_overall_score: e.weighted_overall_score,
    time_spent_seconds: e.time_spent_seconds,
    started_at: e.started_at,
    completed_at: e.completed_at,
    updated_at: e.updated_at,
    flagged_for_review: e.flagged_for_review === 1,
    overall_comment: e.overall_comment,
    scores: e.scores.map((s) => ({
      criterion_id: s.criterion_id,
      score: s.score,
      comment: s.comment,
    })),
  };
}

/**
 * The admin's view of some other judge's evaluation. Built field by field rather than by
 * omitting from evaluationOut, so a new private field added above cannot leak here by
 * default -- the same discipline the submission serializers use for team_identifier.
 */
function adminEvaluationOut(
  e: evaluationRepo.EvaluationWithDetail & { judge_email: string; judge_full_name: string | null },
  isCounted: boolean
) {
  return {
    id: e.id,
    submission_id: e.submission_id,
    status: e.status,
    weighted_overall_score: e.weighted_overall_score,
    time_spent_seconds: e.time_spent_seconds,
    started_at: e.started_at,
    completed_at: e.completed_at,
    updated_at: e.updated_at,
    /** Whether this review is one of the first five completed, i.e. whether it moved the score. */
    counts_toward_score: isCounted,
    overall_comment: e.overall_comment,
    scores: e.scores.map((s) => ({
      criterion_id: s.criterion_id,
      score: s.score,
      comment: s.comment,
    })),
    judge: { id: e.judge_id, email: e.judge_email, full_name: e.judge_full_name },
  };
}

function criterionBrief(c: { id: number; name: string; description: string; weight: number; order_index: number }) {
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    weight: c.weight,
    order_index: c.order_index,
  };
}

export const evaluationRoutes = new Hono<AppEnv>();

evaluationRoutes.use("*", requireUser);

/**
 * Admin-only view of every judge's evaluation for a submission, including ones beyond the
 * scoring limit -- flagged with counts_toward_score so the admin can see which moved the
 * number. Registered before the judge-scoped "/:evaluation_id" routes so the literal path
 * is not captured by the param.
 */
evaluationRoutes.get("/submission/:submission_id/all", requireAdmin, async (c) => {
  const submissionId = c.req.param("submission_id");
  const rows = await evaluationRepo.listForSubmission(c.env.DB, submissionId);
  const counted = new Set(await countedEvaluationIds(c.env.DB, submissionId));
  return c.json(rows.map((row) => adminEvaluationOut(row, counted.has(row.id))));
});

/**
 * Every submission, with this reviewer's own evaluation state attached. Replaces the old
 * "/assigned" list: there is no allocation any more, so a reviewer's worklist -- judge or
 * admin alike -- is the whole field and the ordering choice is theirs.
 *
 * `counted_reviews` lets the client warn that a submission already has its full complement
 * of scoring reviews before the reviewer spends time on it.
 */
evaluationRoutes.get("/reviewable", requireReviewer, async (c) => {
  const reviewer = c.get("user");
  const criteria = CRITERIA_ORDERED.map(criterionBrief);

  const applications = await applicationRepo.listAll(c.env.EVENTS_DB);
  const mine = await evaluationRepo.listForJudge(c.env.DB, reviewer.id);
  const bySubmission = new Map(mine.map((e) => [e.submission_id, e]));
  const completedCounts = await evaluationRepo.completedCountsBySubmission(c.env.DB);

  return c.json(
    applications.map((application) => {
      const evaluation = bySubmission.get(application.team_id);
      const completed = completedCounts.get(application.team_id) ?? 0;
      return {
        // Judge-facing: structurally omits team_identifier.
        submission: submissionJudgeOut(application),
        evaluation: evaluation ? evaluationOut(evaluation) : null,
        counted_reviews: Math.min(completed, SCORING_EVALUATION_LIMIT),
        scoring_limit: SCORING_EVALUATION_LIMIT,
        criteria,
      };
    })
  );
});

evaluationRoutes.get("/progress", requireReviewer, async (c) => {
  const reviewer = c.get("user");
  const evaluations = await evaluationRepo.listForJudge(c.env.DB, reviewer.id);
  const total = (await applicationRepo.listAll(c.env.EVENTS_DB)).length;
  const completed = evaluations.filter((e) => e.status === "completed").length;
  const inProgress = evaluations.filter((e) => e.status === "in_progress").length;
  return c.json({
    // "Total" is now the whole field rather than an allocation, so not_started covers every
    // submission this reviewer has never opened.
    total_assigned: total,
    completed,
    in_progress: inProgress,
    not_started: Math.max(total - completed - inProgress, 0),
    percent_complete: total ? Math.round((completed / total) * 100 * 10) / 10 : 0.0,
    flagged: evaluations.filter((e) => e.flagged_for_review === 1).length,
  });
});

/**
 * Open a submission for review, creating this reviewer's evaluation on first visit. Replaces
 * the admin-side assignment step: a judge -- or an admin, since organisers judge too -- starts
 * work simply by opening something.
 */
evaluationRoutes.post("/open/:submission_id", requireReviewer, async (c) => {
  const reviewer = c.get("user");
  const submissionId = c.req.param("submission_id");

  const application = await applicationRepo.get(c.env.EVENTS_DB, submissionId);
  if (!application) throw notFound("Submission not found");

  const evaluation = await evaluationRepo.getOrCreateForJudge(c.env.DB, submissionId, reviewer.id);
  return c.json(evaluationOut(evaluation), 201);
});

/** 404 rather than 403 on someone else's evaluation, so existence is not leaked. */
async function ownedEvaluation(
  db: D1Database,
  evaluationId: number,
  reviewerId: number
): Promise<evaluationRepo.EvaluationWithDetail> {
  const evaluation = await evaluationRepo.get(db, evaluationId);
  if (!evaluation || evaluation.judge_id !== reviewerId) throw notFound("Evaluation not found");
  return evaluation;
}

evaluationRoutes.get("/:evaluation_id", requireReviewer, async (c) => {
  const evaluationId = intPathParam("evaluation_id", c.req.param("evaluation_id"));
  const reviewer = c.get("user");
  const evaluation = await ownedEvaluation(c.env.DB, evaluationId, reviewer.id);

  const criteria = CRITERIA_ORDERED.map(criterionBrief);
  const submission = await applicationRepo.get(c.env.EVENTS_DB, evaluation.submission_id);
  if (!submission) throw notFound("Evaluation not found");

  // Whether this reviewer's review will move the score. Their own in-flight review is excluded
  // from the count, so an unfinished review never reports itself as one of the five.
  const counted = await countedEvaluationIds(c.env.DB, evaluation.submission_id);
  const countsTowardScore =
    counted.includes(evaluation.id) || counted.length < SCORING_EVALUATION_LIMIT;

  return c.json({
    evaluation: evaluationOut(evaluation),
    submission: submissionJudgeOut(submission),
    criteria,
    counted_reviews: counted.length,
    scoring_limit: SCORING_EVALUATION_LIMIT,
    counts_toward_score: countsTowardScore,
  });
});

/** Toggle this reviewer's private "come back to this" bookmark. */
evaluationRoutes.patch("/:evaluation_id/flag", requireReviewer, async (c) => {
  const evaluationId = intPathParam("evaluation_id", c.req.param("evaluation_id"));
  const reviewer = c.get("user");
  const evaluation = await ownedEvaluation(c.env.DB, evaluationId, reviewer.id);
  const payload = parseOrThrow(evaluationFlagSchema, await readJson(c.req), "body");

  await evaluationRepo.setFlagged(c.env.DB, evaluation.id, payload.flagged_for_review);
  const refreshed = await evaluationRepo.get(c.env.DB, evaluation.id);
  if (!refreshed) throw notFound("Evaluation not found");
  return c.json(evaluationOut(refreshed));
});

evaluationRoutes.patch("/:evaluation_id", requireReviewer, async (c) => {
  const evaluationId = intPathParam("evaluation_id", c.req.param("evaluation_id"));
  const reviewer = c.get("user");
  const evaluation = await ownedEvaluation(c.env.DB, evaluationId, reviewer.id);
  const payload = parseOrThrow(evaluationAutosaveSchema, await readJson(c.req), "body");

  const fields: {
    started_at?: string;
    time_spent_seconds?: number;
    status?: string;
    completed_at?: string | null;
  } = {};

  if (evaluation.started_at === null) fields.started_at = nowIso();

  for (const entry of payload.scores) {
    await evaluationRepo.upsertScore(
      c.env.DB,
      evaluation.id,
      entry.criterion_id,
      entry.score ?? null,
      entry.comment ?? null
    );
  }

  if (payload.overall_comment !== null && payload.overall_comment !== undefined) {
    await evaluationRepo.upsertComment(c.env.DB, evaluation.id, payload.overall_comment);
  }

  if (payload.time_spent_delta_seconds) {
    fields.time_spent_seconds = evaluation.time_spent_seconds + payload.time_spent_delta_seconds;
  }

  if (payload.mark_complete === true) {
    fields.status = "completed";
    fields.completed_at = nowIso();
  } else if (payload.mark_complete === false) {
    fields.status = "in_progress";
    fields.completed_at = null;
  } else if (evaluation.status === "not_started") {
    fields.status = "in_progress";
  }

  await evaluationRepo.applyAutosave(c.env.DB, evaluation.id, fields);

  const refreshed = await evaluationRepo.get(c.env.DB, evaluation.id);
  if (!refreshed) throw notFound("Evaluation not found");

  if (refreshed.status === "completed" || refreshed.completed_at !== null) {
    await recomputeSubmissionScore(c.env.DB, refreshed.submission_id);
  }

  const final = await evaluationRepo.get(c.env.DB, evaluation.id);
  return c.json(evaluationOut(final ?? refreshed));
});
