import { Hono } from "hono";

import { conflict, notFound } from "../http";
import { intPathParam, intQueryParam, parseOrThrow, readJson } from "../lib/validate";
import { requireAdmin, requireUser, type AppEnv } from "../middleware/auth";
import * as assignmentRepo from "../repo/assignment";
import * as auditRepo from "../repo/audit";
import * as submissionRepo from "../repo/submission";
import * as userRepo from "../repo/user";
import {
  conflictExclusionSchema,
  generateAssignmentsSchema,
  manualAssignmentSchema,
} from "../schemas/assignment";
import { generateAssignments } from "../services/assignments";

/** Matches AssignmentOut in backend/app/schemas/assignment.py. */
function assignmentOut(row: assignmentRepo.AssignmentJoined) {
  return {
    id: row.id,
    submission: {
      id: row.submission_id,
      project_title: row.submission_title,
      team_identifier: row.submission_team,
    },
    judge: { id: row.judge_id, email: row.judge_email, full_name: row.judge_full_name },
    source: row.source,
    assigned_at: row.assigned_at,
    evaluation_status: row.evaluation_status ?? "not_started",
  };
}

export const assignmentRoutes = new Hono<AppEnv>();

assignmentRoutes.use("*", requireUser, requireAdmin);

assignmentRoutes.get("/conflicts", async (c) =>
  c.json(await assignmentRepo.listConflicts(c.env.DB))
);

assignmentRoutes.post("/conflicts", async (c) => {
  const payload = parseOrThrow(conflictExclusionSchema, await readJson(c.req), "body");
  const row = await assignmentRepo.createConflict(
    c.env.DB,
    payload.submission_id,
    payload.judge_id,
    payload.reason ?? null
  );
  const admin = c.get("user");
  await auditRepo.create(c.env.DB, admin.id, "create", "conflict_exclusion", row.id, {});
  return c.json(row, 201);
});

assignmentRoutes.delete("/conflicts/:conflict_id", async (c) => {
  const conflictId = intPathParam("conflict_id", c.req.param("conflict_id"));
  const row = await assignmentRepo.getConflict(c.env.DB, conflictId);
  if (!row) throw notFound("Conflict exclusion not found");

  const admin = c.get("user");
  await auditRepo.create(c.env.DB, admin.id, "delete", "conflict_exclusion", conflictId, {});
  await assignmentRepo.deleteConflict(c.env.DB, conflictId);
  return c.body(null, 204);
});

assignmentRoutes.post("/generate", async (c) => {
  const payload = parseOrThrow(generateAssignmentsSchema, await readJson(c.req), "body");
  const admin = c.get("user");
  const result = await generateAssignments(c.env.DB, payload, admin.id);
  await auditRepo.create(c.env.DB, admin.id, "generate", "assignment", null, { ...result });
  return c.json(result);
});

assignmentRoutes.get("/", async (c) => {
  const judgeId = intQueryParam("judge_id", c.req.query("judge_id"));
  const submissionId = intQueryParam("submission_id", c.req.query("submission_id"));
  const rows = await assignmentRepo.listAll(c.env.DB, judgeId, submissionId);
  return c.json(rows.map(assignmentOut));
});

assignmentRoutes.post("/", async (c) => {
  const payload = parseOrThrow(manualAssignmentSchema, await readJson(c.req), "body");

  if (!(await submissionRepo.get(c.env.DB, payload.submission_id))) {
    throw notFound("Submission not found");
  }
  const judge = await userRepo.getById(c.env.DB, payload.judge_id);
  if (!judge || judge.role !== "judge") throw notFound("Judge not found");
  if (await assignmentRepo.exists(c.env.DB, payload.submission_id, payload.judge_id)) {
    throw conflict("This judge is already assigned to this submission");
  }

  const admin = c.get("user");
  const created = await assignmentRepo.create(
    c.env.DB,
    payload.submission_id,
    payload.judge_id,
    admin.id,
    "manual"
  );
  if (!created) throw notFound("Assignment not found");

  await auditRepo.create(c.env.DB, admin.id, "create", "assignment", created.id, {
    submission_id: payload.submission_id,
    judge_id: payload.judge_id,
  });
  return c.json(assignmentOut(created), 201);
});

assignmentRoutes.delete("/:assignment_id", async (c) => {
  const assignmentId = intPathParam("assignment_id", c.req.param("assignment_id"));
  const row = await assignmentRepo.get(c.env.DB, assignmentId);
  if (!row) throw notFound("Assignment not found");

  const admin = c.get("user");
  await auditRepo.create(c.env.DB, admin.id, "delete", "assignment", assignmentId, {
    submission_id: row.submission_id,
    judge_id: row.judge_id,
  });
  await assignmentRepo.remove(c.env.DB, assignmentId);
  return c.body(null, 204);
});
