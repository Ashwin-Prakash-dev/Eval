import { Hono } from "hono";

import { intQueryParam } from "../lib/validate";
import { requireAdmin, requireUser, type AppEnv } from "../middleware/auth";
import * as analytics from "../services/analytics";

export const analyticsRoutes = new Hono<AppEnv>();

analyticsRoutes.use("*", requireUser, requireAdmin);

analyticsRoutes.get("/overview", async (c) => c.json(await analytics.getOverview(c.env.DB)));

analyticsRoutes.get("/leaderboard", async (c) => {
  const page = intQueryParam("page", c.req.query("page"), 1);
  const pageSize = intQueryParam("page_size", c.req.query("page_size"), 25);
  const problemStatementId = intQueryParam(
    "problem_statement_id",
    c.req.query("problem_statement_id")
  );

  const { entries, total } = await analytics.getLeaderboard(c.env.DB, {
    search: c.req.query("search"),
    problem_statement_id: problemStatementId,
    sort_by: c.req.query("sort_by") ?? "overall_score",
    sort_dir: c.req.query("sort_dir") ?? "desc",
    page,
    page_size: pageSize,
  });

  return c.json({
    items: entries,
    total,
    page,
    page_size: pageSize,
    total_pages: Math.max(Math.ceil(total / pageSize), 1),
  });
});
