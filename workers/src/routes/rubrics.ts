import { Hono } from "hono";

import { CRITERIA_ORDERED, DISAGREEMENT_THRESHOLD, RUBRIC_NAME } from "../config/rubric";
import { requireUser, type AppEnv } from "../middleware/auth";

export const rubricRoutes = new Hono<AppEnv>();

rubricRoutes.use("*", requireUser);

/**
 * The rubric is a deployed constant (see config/rubric.ts), so this is the only route left:
 * there is nothing to create, activate or delete. The response shape is unchanged, which is
 * why the frontend needs no edits. `created_at` and the rubric `id` are no longer meaningful
 * but are still emitted so the existing client types keep validating.
 *
 * Judges need this to render the evaluation form, so it is not admin-only.
 */
rubricRoutes.get("/active", (c) =>
  c.json({
    id: 1,
    name: RUBRIC_NAME,
    is_active: true,
    disagreement_threshold: DISAGREEMENT_THRESHOLD,
    created_at: null,
    criteria: CRITERIA_ORDERED.map((criterion) => ({
      id: criterion.id,
      name: criterion.name,
      description: criterion.description,
      weight: criterion.weight,
      order_index: criterion.order_index,
    })),
  })
);
