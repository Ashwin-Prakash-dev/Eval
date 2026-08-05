import { Hono } from "hono";

import { conflict, notFound } from "../http";
import { intPathParam, parseOrThrow, readJson } from "../lib/validate";
import { requireAdmin, requireUser, type AppEnv } from "../middleware/auth";
import * as auditRepo from "../repo/audit";
import * as psRepo from "../repo/problem_statement";
import { problemStatementCreateSchema, problemStatementUpdateSchema } from "../schemas/submission";

const UPDATABLE = ["code", "title", "description"] as const;

export const problemStatementRoutes = new Hono<AppEnv>();

problemStatementRoutes.use("*", requireUser);

/** Listing is available to any authenticated user; judges need it to render a submission. */
problemStatementRoutes.get("/", async (c) => c.json(await psRepo.listAll(c.env.DB)));

problemStatementRoutes.post("/", requireAdmin, async (c) => {
  const payload = parseOrThrow(problemStatementCreateSchema, await readJson(c.req), "body");
  if (await psRepo.getByCode(c.env.DB, payload.code)) {
    throw conflict("A problem statement with this code already exists");
  }
  const ps = await psRepo.create(c.env.DB, payload);
  const admin = c.get("user");
  await auditRepo.create(c.env.DB, admin.id, "create", "problem_statement", ps.id, { code: ps.code });
  return c.json(ps, 201);
});

problemStatementRoutes.patch("/:ps_id", requireAdmin, async (c) => {
  const psId = intPathParam("ps_id", c.req.param("ps_id"));
  const body = (await readJson(c.req)) as Record<string, unknown>;
  parseOrThrow(problemStatementUpdateSchema, body, "body");

  if (!(await psRepo.get(c.env.DB, psId))) throw notFound("Problem statement not found");

  const patch: Record<string, unknown> = {};
  for (const field of UPDATABLE) {
    if (Object.prototype.hasOwnProperty.call(body, field)) patch[field] = body[field];
  }

  const updated = await psRepo.update(c.env.DB, psId, patch);
  if (!updated) throw notFound("Problem statement not found");

  const admin = c.get("user");
  await auditRepo.create(c.env.DB, admin.id, "update", "problem_statement", psId, patch);
  return c.json(updated);
});

problemStatementRoutes.delete("/:ps_id", requireAdmin, async (c) => {
  const psId = intPathParam("ps_id", c.req.param("ps_id"));
  const ps = await psRepo.get(c.env.DB, psId);
  if (!ps) throw notFound("Problem statement not found");

  const admin = c.get("user");
  await auditRepo.create(c.env.DB, admin.id, "delete", "problem_statement", psId, { code: ps.code });
  await psRepo.remove(c.env.DB, psId);
  return c.body(null, 204);
});
