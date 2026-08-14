import { Hono } from "hono";

import { CRITERIA_ORDERED } from "../config/rubric";
import { conflict, notFound } from "../http";
import { nowIso } from "../lib/time";
import { intPathParam, parseOrThrow, readJson } from "../lib/validate";
import { requireAdmin, requireReviewer, requireUser, type AppEnv } from "../middleware/auth";
import * as applicationRepo from "../repo/application";
import * as auditRepo from "../repo/audit";
import * as evaluationRepo from "../repo/evaluation";
import { evaluationAutosaveSchema, evaluationFlagSchema } from "../schemas/evaluation";
import { submissionJudgeOut, toIso } from "../serializers/submission";
import {
  applicationContentHash,
  contentHashesByTeamId,
  needsReevaluation,
} from "../services/revision";
import {
  countedEvaluationIds,
  recomputeSubmissionScore,
  SCORING_EVALUATION_LIMIT,
} from "../services/scoring";

/**
 * The judge's own view of their evaluation.
 *
 * `flagged_for_review` appears here and NOWHERE else: it is a private bookmark, so it must
 * not reach another judge or an admin. See adminEvaluationOut, which omits it.
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
  isCounted: boolean,
  isStale: boolean
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
    /**
     * The team edited their submission after this review was completed, so it no longer
     * counts and the judge has to redo it. Distinct from submission_scores.is_flagged, which
     * means the judges disagreed with each other.
     */
    needs_reevaluation: isStale,
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
  // A missing application (the team was deleted on the startathon side) leaves the hash null,
  // which needsReevaluation treats as "not stale" -- there is nothing to compare against and
  // discarding reviews would not bring the submission back.
  const application = await applicationRepo.get(c.env.EVENTS_DB, submissionId);
  const currentHash = application ? await applicationContentHash(application) : null;

  const rows = await evaluationRepo.listForSubmission(c.env.DB, submissionId);
  const counted = new Set(await countedEvaluationIds(c.env.DB, submissionId, currentHash));
  return c.json(
    rows.map((row) =>
      adminEvaluationOut(row, counted.has(row.id), needsReevaluation(row, currentHash))
    )
  );
});

/**
 * Every submission, with this judge's own evaluation state attached. Replaces the old
 * "/assigned" list: there is no allocation any more, so a judge's worklist is the whole
 * field and the ordering choice is theirs.
 *
 * `counted_reviews` lets the client warn that a submission already has its full complement
 * of scoring reviews before the judge spends time on it.
 *
 * `needs_reevaluation` has to be here rather than only on the detail view: a judge must be
 * able to spot a review invalidated by an applicant's edit from a plain refresh of this list,
 * without opening all of them to find out. It is computed inside the loop this route already
 * runs, from two reads that were already happening -- no extra query per row.
 */
evaluationRoutes.get("/reviewable", requireReviewer, async (c) => {
  const judge = c.get("user");
  const criteria = CRITERIA_ORDERED.map(criterionBrief);

  const applications = await applicationRepo.listAll(c.env.EVENTS_DB);
  const hashes = await contentHashesByTeamId(applications);
  const mine = await evaluationRepo.listForJudge(c.env.DB, judge.id);
  const bySubmission = new Map(mine.map((e) => [e.submission_id, e]));
  const completedBy = await evaluationRepo.completedBySubmission(c.env.DB);

  return c.json(
    applications.map((application) => {
      const evaluation = bySubmission.get(application.team_id);
      const currentHash = hashes.get(application.team_id) ?? null;
      // Reviews of a since-edited version are not counted here either, so a submission whose
      // five reviews were all invalidated correctly reads as needing reviews again.
      const completed = (completedBy.get(application.team_id) ?? []).filter(
        (e) => !needsReevaluation(e, currentHash)
      ).length;
      return {
        // Judge-facing: structurally omits team_identifier.
        submission: submissionJudgeOut(application),
        evaluation: evaluation ? evaluationOut(evaluation) : null,
        needs_reevaluation: needsReevaluation(evaluation, currentHash),
        /** Sibling of `submission`, not part of it -- see toIso in the serializer. */
        submission_updated_at: toIso(application.updated_at),
        counted_reviews: Math.min(completed, SCORING_EVALUATION_LIMIT),
        scoring_limit: SCORING_EVALUATION_LIMIT,
        criteria,
      };
    })
  );
});

evaluationRoutes.get("/progress", requireReviewer, async (c) => {
  const judge = c.get("user");
  const evaluations = await evaluationRepo.listForJudge(c.env.DB, judge.id);
  const applications = await applicationRepo.listAll(c.env.EVENTS_DB);
  const hashes = await contentHashesByTeamId(applications);
  const total = applications.length;

  // A review invalidated by an applicant's edit stops counting as done. Every stale
  // evaluation is by definition 'completed', so it is subtracted from that count rather than
  // from in_progress, and the judge's percentage drops to reflect the work that came back.
  const stale = evaluations.filter((e) =>
    needsReevaluation(e, hashes.get(e.submission_id) ?? null)
  ).length;
  const completed = evaluations.filter((e) => e.status === "completed").length - stale;
  const inProgress = evaluations.filter((e) => e.status === "in_progress").length;

  return c.json({
    // "Total" is now the whole field rather than an allocation, so not_started covers every
    // submission this judge has never opened.
    total_assigned: total,
    completed,
    in_progress: inProgress,
    needs_reevaluation: stale,
    not_started: Math.max(total - completed - inProgress - stale, 0),
    percent_complete: total ? Math.round((completed / total) * 100 * 10) / 10 : 0.0,
    flagged: evaluations.filter((e) => e.flagged_for_review === 1).length,
  });
});

/**
 * Open a submission for review, creating this judge's evaluation on first visit. Replaces the
 * admin-side assignment step: a judge starts work simply by opening something.
 *
 * This is also where a review invalidated by an applicant's edit is discarded. That work is
 * done here rather than on any GET for two reasons: a read must never destroy data, and the
 * `needs_reevaluation` flag has to survive on the worklist until the judge actually acts on
 * it. Because the reset is irreversible, it happens only when `?confirm_reset=true` says the
 * judge was asked and agreed -- opening the page is not consent.
 */
evaluationRoutes.post("/open/:submission_id", requireReviewer, async (c) => {
  const judge = c.get("user");
  const submissionId = c.req.param("submission_id");

  const application = await applicationRepo.get(c.env.EVENTS_DB, submissionId);
  if (!application) throw notFound("Submission not found");

  const currentHash = await applicationContentHash(application);
  const evaluation = await evaluationRepo.getOrCreateForJudge(c.env.DB, submissionId, judge.id);

  if (!needsReevaluation(evaluation, currentHash)) {
    return c.json(evaluationOut(evaluation), 201);
  }

  if (c.req.query("confirm_reset") !== "true") {
    throw conflict(
      "This submission was edited after you completed your review. Starting again will " +
        "discard the scores and comments you gave the previous version."
    );
  }

  // Written BEFORE the delete: the scores are hard-deleted, so this entry is the only
  // surviving record of what was discarded. entity_id takes the evaluation id because the
  // column is INTEGER and a submission id is the startathon team_id, a string -- that goes in
  // the details payload instead.
  await auditRepo.create(
    c.env.DB,
    judge.id,
    "reset_stale_evaluation",
    "evaluation",
    evaluation.id,
    {
      submission_id: submissionId,
      completed_at: evaluation.completed_at,
      weighted_overall_score: evaluation.weighted_overall_score,
      reviewed_content_hash: evaluation.reviewed_content_hash,
      current_content_hash: currentHash,
      discarded_scores: evaluation.scores.map((s) => ({
        criterion_id: s.criterion_id,
        score: s.score,
        comment: s.comment,
      })),
      discarded_overall_comment: evaluation.overall_comment,
    }
  );

  await evaluationRepo.resetForReevaluation(c.env.DB, evaluation.id);

  // Not optional and not deferrable. submission_scores still counts this review until it is
  // rebuilt, so skipping this leaves the leaderboard showing an overall_score and a review
  // count derived from content that no longer exists, until some unrelated evaluation happens
  // to touch this submission.
  await recomputeSubmissionScore(c.env.DB, submissionId, currentHash);

  const reset = await evaluationRepo.get(c.env.DB, evaluation.id);
  if (!reset) throw notFound("Evaluation not found");
  return c.json(evaluationOut(reset), 201);
});

/** 404 rather than 403 on someone else's evaluation, so existence is not leaked. */
async function ownedEvaluation(
  db: D1Database,
  evaluationId: number,
  judgeId: number
): Promise<evaluationRepo.EvaluationWithDetail> {
  const evaluation = await evaluationRepo.get(db, evaluationId);
  if (!evaluation || evaluation.judge_id !== judgeId) throw notFound("Evaluation not found");
  return evaluation;
}

evaluationRoutes.get("/:evaluation_id", requireReviewer, async (c) => {
  const evaluationId = intPathParam("evaluation_id", c.req.param("evaluation_id"));
  const judge = c.get("user");
  const evaluation = await ownedEvaluation(c.env.DB, evaluationId, judge.id);

  const criteria = CRITERIA_ORDERED.map(criterionBrief);
  const submission = await applicationRepo.get(c.env.EVENTS_DB, evaluation.submission_id);
  if (!submission) throw notFound("Evaluation not found");
  const currentHash = await applicationContentHash(submission);

  // Whether this judge's review will move the score. Their own in-flight review is excluded
  // from the count, so an unfinished review never reports itself as one of the five.
  const counted = await countedEvaluationIds(c.env.DB, evaluation.submission_id, currentHash);
  const countsTowardScore =
    counted.includes(evaluation.id) || counted.length < SCORING_EVALUATION_LIMIT;

  return c.json({
    evaluation: evaluationOut(evaluation),
    submission: submissionJudgeOut(submission),
    criteria,
    needs_reevaluation: needsReevaluation(evaluation, currentHash),
    submission_updated_at: toIso(submission.updated_at),
    counted_reviews: counted.length,
    scoring_limit: SCORING_EVALUATION_LIMIT,
    counts_toward_score: countsTowardScore,
  });
});

/** Toggle this judge's private "come back to this" bookmark. */
evaluationRoutes.patch("/:evaluation_id/flag", requireReviewer, async (c) => {
  const evaluationId = intPathParam("evaluation_id", c.req.param("evaluation_id"));
  const judge = c.get("user");
  const evaluation = await ownedEvaluation(c.env.DB, evaluationId, judge.id);
  const payload = parseOrThrow(evaluationFlagSchema, await readJson(c.req), "body");

  await evaluationRepo.setFlagged(c.env.DB, evaluation.id, payload.flagged_for_review);
  const refreshed = await evaluationRepo.get(c.env.DB, evaluation.id);
  if (!refreshed) throw notFound("Evaluation not found");
  return c.json(evaluationOut(refreshed));
});

evaluationRoutes.patch("/:evaluation_id", requireReviewer, async (c) => {
  const evaluationId = intPathParam("evaluation_id", c.req.param("evaluation_id"));
  const judge = c.get("user");
  const evaluation = await ownedEvaluation(c.env.DB, evaluationId, judge.id);
  const payload = parseOrThrow(evaluationAutosaveSchema, await readJson(c.req), "body");

  const application = await applicationRepo.get(c.env.EVENTS_DB, evaluation.submission_id);
  if (!application) throw notFound("Evaluation not found");
  const currentHash = await applicationContentHash(application);

  const fields: {
    started_at?: string;
    time_spent_seconds?: number;
    status?: string;
    completed_at?: string | null;
    reviewed_content_hash?: string | null;
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
    // Stamped at the same moment as completed_at: this records exactly which version of the
    // application the judge signed off on, and every later staleness check compares to it.
    fields.reviewed_content_hash = currentHash;
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
    await recomputeSubmissionScore(c.env.DB, refreshed.submission_id, currentHash);
  }

  const final = await evaluationRepo.get(c.env.DB, evaluation.id);
  return c.json(evaluationOut(final ?? refreshed));
});
