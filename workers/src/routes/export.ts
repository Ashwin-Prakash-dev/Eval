import { Hono } from "hono";

import { badRequest } from "../http";
import { requireAdmin, requireUser, type AppEnv } from "../middleware/auth";
import { buildCsv, buildPdf, buildXlsx } from "../services/export";

const CONTENT_TYPES: Record<string, string> = {
  csv: "text/csv",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
};

const BUILDERS: Record<string, (db: D1Database, eventsDb: D1Database) => Promise<Uint8Array>> = {
  csv: buildCsv,
  xlsx: buildXlsx,
  pdf: buildPdf,
};

export const exportRoutes = new Hono<AppEnv>();

exportRoutes.use("*", requireUser, requireAdmin);

exportRoutes.get("/:export_format", async (c) => {
  const format = c.req.param("export_format");
  const builder = BUILDERS[format];
  if (!builder) throw badRequest("format must be one of: csv, xlsx, pdf");

  const content = await builder(c.env.DB, c.env.EVENTS_DB);
  return new Response(content, {
    headers: {
      "Content-Type": CONTENT_TYPES[format]!,
      "Content-Disposition": `attachment; filename="hackathon-report.${format}"`,
    },
  });
});
