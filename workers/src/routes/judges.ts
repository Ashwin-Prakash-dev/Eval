import { Hono } from "hono";

import type { AllowedEmail, User } from "../db";
import { badRequest, conflict, notFound } from "../http";
import { intPathParam, parseOrThrow, readJson } from "../lib/validate";
import { requireAdmin, requireUser, type AppEnv } from "../middleware/auth";
import * as accessRepo from "../repo/access";
import * as auditRepo from "../repo/audit";
import * as userRepo from "../repo/user";
import {
  allowedEmailBulkSchema,
  allowedEmailCreateSchema,
  allowedEmailUpdateSchema,
  judgeUpdateSchema,
} from "../schemas/judge";
import { computeJudgeStats } from "../services/judge_stats";

/** Matches JudgeOut in backend/app/schemas/user.py. */
function judgeOut(user: User) {
  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    is_active: user.is_active,
    created_at: user.created_at,
    last_login: user.last_login,
  };
}

function allowedOut(entry: AllowedEmail, user: User | undefined) {
  return {
    id: entry.id,
    email: entry.email,
    role: entry.role,
    full_name: entry.full_name,
    note: entry.note,
    is_active: entry.is_active,
    created_at: entry.created_at,
    user: user ? judgeOut(user) : null,
  };
}

export const judgeRoutes = new Hono<AppEnv>();

judgeRoutes.use("*", requireUser, requireAdmin);

judgeRoutes.get("/allowed", async (c) => {
  const entries = await accessRepo.listAllowed(c.env.DB, c.req.query("search"));
  const users = await accessRepo.usersByEmail(c.env.DB, entries.map((e) => e.email));
  return c.json(entries.map((entry) => allowedOut(entry, users.get(entry.email))));
});

judgeRoutes.post("/allowed", async (c) => {
  const payload = parseOrThrow(allowedEmailCreateSchema, await readJson(c.req), "body");
  if (await accessRepo.getAllowedByEmail(c.env.DB, payload.email)) {
    throw conflict("That email is already on the approved list");
  }
  const admin = c.get("user");
  const entry = await accessRepo.createAllowed(c.env.DB, payload, admin.id);
  await auditRepo.create(c.env.DB, admin.id, "approve_email", "allowed_email", entry.id, {
    email: entry.email,
    role: entry.role,
  });
  const user = await userRepo.getByEmail(c.env.DB, entry.email);
  return c.json(allowedOut(entry, user ?? undefined), 201);
});

judgeRoutes.post("/allowed/bulk", async (c) => {
  const payload = parseOrThrow(allowedEmailBulkSchema, await readJson(c.req), "body");
  const admin = c.get("user");

  let created = 0;
  const skipped: string[] = [];
  for (const rawEmail of payload.emails) {
    const email = userRepo.normalizeEmail(rawEmail);
    if (await accessRepo.getAllowedByEmail(c.env.DB, email)) {
      skipped.push(email);
      continue;
    }
    await accessRepo.createAllowed(c.env.DB, { email, role: payload.role }, admin.id);
    created += 1;
  }

  await auditRepo.create(c.env.DB, admin.id, "approve_email_bulk", "allowed_email", null, {
    created,
    skipped: skipped.length,
  });
  return c.json({ created, skipped: skipped.length, skipped_emails: skipped });
});

judgeRoutes.patch("/allowed/:allowed_id", async (c) => {
  const allowedId = intPathParam("allowed_id", c.req.param("allowed_id"));
  const body = (await readJson(c.req)) as Record<string, unknown>;
  const payload = parseOrThrow(allowedEmailUpdateSchema, body, "body");

  if (!(await accessRepo.getAllowed(c.env.DB, allowedId))) {
    throw notFound("Approved email not found");
  }

  const patch: Record<string, unknown> = {};
  for (const field of ["full_name", "note", "is_active"] as const) {
    if (Object.prototype.hasOwnProperty.call(body, field)) patch[field] = payload[field];
  }

  const entry = await accessRepo.updateAllowed(c.env.DB, allowedId, patch);
  if (!entry) throw notFound("Approved email not found");

  const admin = c.get("user");
  await auditRepo.create(c.env.DB, admin.id, "update", "allowed_email", entry.id, patch);

  // Revoking access must also lock out any session-bearing account for that address.
  let user = await userRepo.getByEmail(c.env.DB, entry.email);
  if (user && payload.is_active !== undefined && payload.is_active !== null) {
    user = await userRepo.updateUser(c.env.DB, user.id, { is_active: payload.is_active });
  }
  return c.json(allowedOut(entry, user ?? undefined));
});

judgeRoutes.delete("/allowed/:allowed_id", async (c) => {
  const allowedId = intPathParam("allowed_id", c.req.param("allowed_id"));
  const entry = await accessRepo.getAllowed(c.env.DB, allowedId);
  if (!entry) throw notFound("Approved email not found");

  const admin = c.get("user");
  if (entry.email === admin.email) throw badRequest("You cannot remove your own access");

  // The account keeps its evaluations but can no longer obtain a passcode or use an
  // existing token, so removal is an immediate revocation rather than a data purge.
  const user = await userRepo.getByEmail(c.env.DB, entry.email);
  if (user) await userRepo.updateUser(c.env.DB, user.id, { is_active: false });

  await auditRepo.create(c.env.DB, admin.id, "revoke_email", "allowed_email", entry.id, {
    email: entry.email,
  });
  await accessRepo.deleteAllowed(c.env.DB, allowedId);
  return c.body(null, 204);
});

// Reviewer performance, not account roster: sourced from listReviewers so an admin who
// reviews gets stats too. It still renders correctly in the Judges & access table, which
// already matches stats to allowed-email rows by user id regardless of role.
judgeRoutes.get("/stats", async (c) => {
  const reviewers = await userRepo.listReviewers(c.env.DB);
  const stats = await computeJudgeStats(c.env.DB, reviewers);
  return c.json(stats.map((s) => ({ ...s, judge: judgeOut(s.judge) })));
});

/** Judges who have signed in at least once; /allowed covers the full approved list. */
judgeRoutes.get("/", async (c) =>
  c.json((await userRepo.listReviewers(c.env.DB, c.req.query("search"))).map(judgeOut))
);

judgeRoutes.patch("/:judge_id", async (c) => {
  const judgeId = intPathParam("judge_id", c.req.param("judge_id"));
  const body = (await readJson(c.req)) as Record<string, unknown>;
  const payload = parseOrThrow(judgeUpdateSchema, body, "body");

  const admin = c.get("user");
  const judge = await userRepo.getById(c.env.DB, judgeId);
  // Administrators appear in this list now that they review, so the guard admits them too.
  if (!judge || (judge.role !== "judge" && judge.role !== "admin")) throw notFound("Judge not found");

  const patch: { full_name?: string | null; is_active?: boolean } = {};
  if (Object.prototype.hasOwnProperty.call(body, "full_name")) patch.full_name = payload.full_name;
  if (Object.prototype.hasOwnProperty.call(body, "is_active") && payload.is_active !== null) {
    // Deactivating yourself would revoke your own console access on the next request, with no
    // way back in unless another administrator happens to exist. Reviewers can still be
    // deactivated, and other administrators can still be deactivated by a colleague.
    if (payload.is_active === false && judge.id === admin.id) {
      throw badRequest("You cannot deactivate your own account");
    }
    patch.is_active = payload.is_active;
  }

  const updated = await userRepo.updateUser(c.env.DB, judgeId, patch);
  if (!updated) throw notFound("Judge not found");

  await auditRepo.create(c.env.DB, admin.id, "update", "judge", judgeId, patch);
  return c.json(judgeOut(updated));
});
