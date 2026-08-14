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
  // One roster query for the whole page rather than one per row.
  const members = await applicationRepo.membersByTeamIds(
    c.env.EVENTS_DB,
    items.map((item) => item.team_id)
  );
  return c.json({
    items: items.map((item) => submissionOut(item, members.get(item.team_id) ?? [])),
    total,
    page,
    page_size: pageSize,
    total_pages: Math.max(Math.ceil(total / pageSize), 1),
  });
});

submissionRoutes.get("/:submission_id", async (c) => {
  const application = await applicationRepo.get(c.env.EVENTS_DB, c.req.param("submission_id"));
  if (!application) throw notFound("Submission not found");
  const members = await applicationRepo.membersForTeam(c.env.EVENTS_DB, application.team_id);
  return c.json(submissionOut(application, members));
});
