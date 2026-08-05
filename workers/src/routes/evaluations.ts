import { Hono } from "hono";

import { FILE_PATH_COLUMN, type SubmissionRow } from "../db";
import { badRequest, notFound } from "../http";
import { nowIso } from "../lib/time";
import { intPathParam, parseOrThrow, readJson } from "../lib/validate";
import { requireAdmin, requireJudge, requireUser, type AppEnv } from "../middleware/auth";
import * as assignmentRepo from "../repo/assignment";
import * as evaluationRepo from "../repo/evaluation";
import * as rubricRepo from "../repo/rubric";
import * as submissionRepo from "../repo/submission";
import { evaluationAutosaveSchema } from "../schemas/evaluation";
import { submissionJudgeOut } from "../serializers/submission";
import { fileResponse, isFileKind } from "../services/files";
import { recomputeSubmissionScore } from "../services/scoring";

/** Matches EvaluationOut in backend/app/schemas/evaluation.py. */
function evaluationOut(e: evaluationRepo.EvaluationWithDetail) {
  return {
    id: e.id,
    assignment_id: e.assignment_id,
    submission_id: e.submission_id,
    status: e.status,
    weighted_overall_score: e.weighted_overall_score,
    time_spent_seconds: e.time_spent_seconds,
    started_at: e.started_at,
    completed_at: e.completed_at,
    updated_at: e.updated_at,
    overall_comment: e.overall_comment,
    scores: e.scores.map((s) => ({
      criterion_id: s.criterion_id,
      score: s.score,
      comment: s.comment,
    })),
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
 * Admin-only view of every judge's evaluation for a submission. Registered before the
 * judge-scoped "/:evaluation_id" routes so the literal path is not captured by the param.
 */
evaluationRoutes.get("/submission/:submission_id/all", requireAdmin, async (c) => {
  const submissionId = intPathParam("submission_id", c.req.param("submission_id"));
  const rows = await evaluationRepo.listForSubmission(c.env.DB, submissionId);
  return c.json(
    rows.map((row) => ({
      ...evaluationOut(row),
      judge: { id: row.judge_id, email: row.judge_email, full_name: row.judge_full_name },
    }))
  );
});

evaluationRoutes.get("/assigned", requireJudge, async (c) => {
  const judge = c.get("user");
  const rubric = await rubricRepo.getActive(c.env.DB);
  const criteria = (rubric?.criteria ?? []).map(criterionBrief);

  const assignments = await assignmentRepo.listAll(c.env.DB, judge.id);
  const results = [];
  for (const assignment of assignments) {
    const evaluation = await evaluationRepo.getByAssignment(c.env.DB, assignment.id);
    if (!evaluation) continue;
    const submission = await submissionRepo.get(c.env.DB, assignment.submission_id);
    if (!submission) continue;
    results.push({
      evaluation: evaluationOut(evaluation),
      // Judge-facing: structurally omits team_identifier.
      submission: submissionJudgeOut(submission),
      criteria,
    });
  }
  return c.json(results);
});

evaluationRoutes.get("/progress", requireJudge, async (c) => {
  const judge = c.get("user");
  const evaluations = await evaluationRepo.listForJudge(c.env.DB, judge.id);
  const total = evaluations.length;
  const completed = evaluations.filter((e) => e.status === "completed").length;
  const inProgress = evaluations.filter((e) => e.status === "in_progress").length;
  return c.json({
    total_assigned: total,
    completed,
    in_progress: inProgress,
    not_started: total - completed - inProgress,
    percent_complete: total ? Math.round((completed / total) * 100 * 10) / 10 : 0.0,
  });
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

evaluationRoutes.get("/:evaluation_id", requireJudge, async (c) => {
  const evaluationId = intPathParam("evaluation_id", c.req.param("evaluation_id"));
  const judge = c.get("user");
  const evaluation = await ownedEvaluation(c.env.DB, evaluationId, judge.id);

  const rubric = await rubricRepo.getActive(c.env.DB);
  const criteria = (rubric?.criteria ?? []).map(criterionBrief);
  const assignment = await assignmentRepo.get(c.env.DB, evaluation.assignment_id);
  if (!assignment) throw notFound("Evaluation not found");
  const submission = await submissionRepo.get(c.env.DB, assignment.submission_id);
  if (!submission) throw notFound("Evaluation not found");

  return c.json({
    evaluation: evaluationOut(evaluation),
    submission: submissionJudgeOut(submission),
    criteria,
  });
});

evaluationRoutes.patch("/:evaluation_id", requireJudge, async (c) => {
  const evaluationId = intPathParam("evaluation_id", c.req.param("evaluation_id"));
  const judge = c.get("user");
  const evaluation = await ownedEvaluation(c.env.DB, evaluationId, judge.id);
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

evaluationRoutes.get("/:evaluation_id/file/:kind", requireJudge, async (c) => {
  const evaluationId = intPathParam("evaluation_id", c.req.param("evaluation_id"));
  const judge = c.get("user");
  const evaluation = await ownedEvaluation(c.env.DB, evaluationId, judge.id);

  const kind = c.req.param("kind");
  if (!isFileKind(kind)) throw badRequest("kind must be one of: ppt, pdf, video");

  const assignment = await assignmentRepo.get(c.env.DB, evaluation.assignment_id);
  if (!assignment) throw notFound("Evaluation not found");
  const submission = await submissionRepo.get(c.env.DB, assignment.submission_id);
  if (!submission) throw notFound("Evaluation not found");

  const key = submission[FILE_PATH_COLUMN[kind] as keyof SubmissionRow] as string | null;
  if (!key) throw notFound("No file uploaded for this field");

  const response = await fileResponse(c.env, key, c.req.header("Range"));
  if (!response) throw notFound("No file uploaded for this field");
  return response;
});
