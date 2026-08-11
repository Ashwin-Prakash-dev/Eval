import { Hono } from "hono";

import { notFound } from "../http";
import { intQueryParam } from "../lib/validate";
import { requireAdmin, requireUser, type AppEnv } from "../middleware/auth";
import * as applicationRepo from "../repo/application";
import { submissionOut } from "../serializers/submission";

/**
 * Read-only. Submissions are `startathon_applications` in EVENTS_DB, owned by the startathon
 * system -- there is nothing here to create, edit or delete, and the deck and video are URLs
 * on that side rather than files this Worker stores.
 */
export const submissionRoutes = new Hono<AppEnv>();

submissionRoutes.use("*", requireUser, requireAdmin);

submissionRoutes.get("/", async (c) => {
  const page = intQueryParam("page", c.req.query("page"), 1);
  const pageSize = intQueryParam("page_size", c.req.query("page_size"), 20);
  const search = c.req.query("search");

  const { items, total } = await applicationRepo.listPaginated(
    c.env.EVENTS_DB,
    page,
    pageSize,
    search
  );
  return c.json({
    items: items.map(submissionOut),
    total,
    page,
    page_size: pageSize,
    total_pages: Math.max(Math.ceil(total / pageSize), 1),
  });
});

submissionRoutes.get("/:submission_id", async (c) => {
  const application = await applicationRepo.get(c.env.EVENTS_DB, c.req.param("submission_id"));
  if (!application) throw notFound("Submission not found");
  return c.json(submissionOut(application));
});
