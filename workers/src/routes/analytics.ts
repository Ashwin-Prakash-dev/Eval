import { Hono } from "hono";

import { intQueryParam } from "../lib/validate";
import { requireAdmin, requireReviewer, requireUser, type AppEnv } from "../middleware/auth";
import * as analytics from "../services/analytics";

export const analyticsRoutes = new Hono<AppEnv>();

/**
 * Authentication is blanket; authorisation is per route.
 *
 * `requireAdmin` used to guard the whole router. The leaderboard is now open to judges as
 * well, so the gate moved onto the individual routes -- `/overview` and `/coverage` stay
 * admin-only, since both are about the judging rather than the results: overview carries
 * per-judge progress, and coverage exists to find gaps an organiser has to chase.
 */
analyticsRoutes.use("*", requireUser);

analyticsRoutes.get("/overview", requireAdmin, async (c) =>
  c.json(await analytics.getOverview(c.env.DB, c.env.EVENTS_DB))
);

analyticsRoutes.get("/coverage", requireAdmin, async (c) =>
  c.json(await analytics.getCoverage(c.env.DB, c.env.EVENTS_DB))
);

/**
 * A judge's view of the leaderboard: the result, without the commentary on how it was
 * reached.
 *
 * `std_dev` and `is_flagged` measure how far the judges diverged from each other. That is an
 * organiser's quality signal about the judging, not a fact about the project, and a judge
 * reading it can work out which submissions they personally were the outlier on. Built field
 * by field rather than by deleting keys, so a field added to the admin entry later does not
 * reach judges by default -- the same discipline the submission serializers use.
 */
function leaderboardJudgeOut(entry: {
  rank: number;
  submission_id: string;
  project_title: string;
  overall_score: number | null;
  criterion_scores: Record<string, number>;
  reviews_completed: number;
}) {
  return {
    rank: entry.rank,
    submission_id: entry.submission_id,
    project_title: entry.project_title,
    overall_score: entry.overall_score,
    criterion_scores: entry.criterion_scores,
    reviews_completed: entry.reviews_completed,
  };
}

analyticsRoutes.get("/leaderboard", requireReviewer, async (c) => {
  const page = intQueryParam("page", c.req.query("page"), 1);
  const pageSize = intQueryParam("page_size", c.req.query("page_size"), 25);
  // A judge sorting by std_dev would order the table by a column they are not shown, so the
  // sort key is clamped for them rather than silently honoured.
  const isAdmin = c.get("user").role === "admin";
  const requestedSort = c.req.query("sort_by") ?? "overall_score";
  const sortBy = !isAdmin && requestedSort === "std_dev" ? "overall_score" : requestedSort;

  const { entries, total } = await analytics.getLeaderboard(c.env.DB, c.env.EVENTS_DB, {
    search: c.req.query("search"),
    sort_by: sortBy,
    sort_dir: c.req.query("sort_dir") ?? "desc",
    page,
    page_size: pageSize,
  });

  return c.json({
    items: isAdmin ? entries : entries.map(leaderboardJudgeOut),
    total,
    page,
    page_size: pageSize,
    total_pages: Math.max(Math.ceil(total / pageSize), 1),
  });
});
