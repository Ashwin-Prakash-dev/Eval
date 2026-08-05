import { Hono } from "hono";

import { intQueryParam } from "../lib/validate";
import { requireAdmin, requireUser, type AppEnv } from "../middleware/auth";
import * as auditRepo from "../repo/audit";

export const auditLogRoutes = new Hono<AppEnv>();

auditLogRoutes.use("*", requireUser, requireAdmin);

auditLogRoutes.get("/", async (c) => {
  const page = intQueryParam("page", c.req.query("page"), 1);
  const pageSize = intQueryParam("page_size", c.req.query("page_size"), 50);
  const entityType = c.req.query("entity_type");

  const { items, total } = await auditRepo.listPaginated(c.env.DB, page, pageSize, entityType);

  return c.json({
    items: items.map((log) => ({
      id: log.id,
      user_id: log.user_id,
      email: log.email,
      action: log.action,
      entity_type: log.entity_type,
      entity_id: log.entity_id,
      // Stored as TEXT; the API contract is a JSON object, as the SQLAlchemy JSON column was.
      details: safeParse(log.details),
      created_at: log.created_at,
    })),
    total,
    page,
    page_size: pageSize,
    total_pages: Math.max(Math.ceil(total / pageSize), 1),
  });
});

function safeParse(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
