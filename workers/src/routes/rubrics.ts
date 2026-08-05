import { Hono } from "hono";

import { notFound } from "../http";
import { intPathParam, parseOrThrow, readJson } from "../lib/validate";
import { requireAdmin, requireUser, type AppEnv } from "../middleware/auth";
import * as auditRepo from "../repo/audit";
import * as rubricRepo from "../repo/rubric";
import { rubricCreateSchema, rubricUpdateSchema } from "../schemas/rubric";

/** Matches RubricOut / CriterionOut in backend/app/schemas/rubric.py. */
function rubricOut(rubric: rubricRepo.Rubric) {
  return {
    id: rubric.id,
    name: rubric.name,
    is_active: rubric.is_active,
    disagreement_threshold: rubric.disagreement_threshold,
    created_at: rubric.created_at,
    criteria: rubric.criteria.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      weight: c.weight,
      order_index: c.order_index,
    })),
  };
}

export const rubricRoutes = new Hono<AppEnv>();

rubricRoutes.use("*", requireUser);

/** Judges need the active rubric to render the evaluation form, so this is not admin-only. */
rubricRoutes.get("/active", async (c) => {
  const rubric = await rubricRepo.getActive(c.env.DB);
  if (!rubric) throw notFound("No active rubric has been configured yet");
  return c.json(rubricOut(rubric));
});

rubricRoutes.get("/", requireAdmin, async (c) =>
  c.json((await rubricRepo.listAll(c.env.DB)).map(rubricOut))
);

rubricRoutes.post("/", requireAdmin, async (c) => {
  const payload = parseOrThrow(rubricCreateSchema, await readJson(c.req), "body");
  const rubric = await rubricRepo.create(c.env.DB, payload);
  const admin = c.get("user");
  await auditRepo.create(c.env.DB, admin.id, "create", "rubric", rubric.id, { name: rubric.name });
  return c.json(rubricOut(rubric), 201);
});

rubricRoutes.patch("/:rubric_id", requireAdmin, async (c) => {
  const rubricId = intPathParam("rubric_id", c.req.param("rubric_id"));
  const body = (await readJson(c.req)) as Record<string, unknown>;
  const payload = parseOrThrow(rubricUpdateSchema, body, "body");

  if (!(await rubricRepo.get(c.env.DB, rubricId))) throw notFound("Rubric not found");

  const patch: { name?: string; disagreement_threshold?: number; is_active?: boolean } = {};
  if (Object.prototype.hasOwnProperty.call(body, "name")) patch.name = payload.name;
  if (Object.prototype.hasOwnProperty.call(body, "disagreement_threshold")) {
    patch.disagreement_threshold = payload.disagreement_threshold;
  }
  if (Object.prototype.hasOwnProperty.call(body, "is_active")) patch.is_active = payload.is_active;

  const updated = await rubricRepo.update(c.env.DB, rubricId, patch, payload.criteria);
  if (!updated) throw notFound("Rubric not found");

  const admin = c.get("user");
  await auditRepo.create(c.env.DB, admin.id, "update", "rubric", rubricId, {});
  return c.json(rubricOut(updated));
});

rubricRoutes.post("/:rubric_id/activate", requireAdmin, async (c) => {
  const rubricId = intPathParam("rubric_id", c.req.param("rubric_id"));
  if (!(await rubricRepo.get(c.env.DB, rubricId))) throw notFound("Rubric not found");

  const updated = await rubricRepo.activate(c.env.DB, rubricId);
  if (!updated) throw notFound("Rubric not found");

  const admin = c.get("user");
  await auditRepo.create(c.env.DB, admin.id, "activate", "rubric", rubricId, {});
  return c.json(rubricOut(updated));
});

rubricRoutes.delete("/:rubric_id", requireAdmin, async (c) => {
  const rubricId = intPathParam("rubric_id", c.req.param("rubric_id"));
  const rubric = await rubricRepo.get(c.env.DB, rubricId);
  if (!rubric) throw notFound("Rubric not found");

  const admin = c.get("user");
  await auditRepo.create(c.env.DB, admin.id, "delete", "rubric", rubricId, { name: rubric.name });
  await rubricRepo.remove(c.env.DB, rubricId);
  return c.body(null, 204);
});
