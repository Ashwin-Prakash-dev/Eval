import { Hono } from "hono";
import { cors } from "hono/cors";
import { ZodError } from "zod";

import { getSettings, type Bindings } from "./env";
import { ApiError } from "./http";

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", (c, next) =>
  cors({
    origin: getSettings(c.env).corsOrigins,
    credentials: true,
    allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Authorization", "Content-Type"],
  })(c, next)
);

// Mirrors the two FastAPI exception handlers in backend/app/main.py: a validation
// failure returns 422 with the per-field list, a bare ValueError returns 400.
app.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json({ detail: err.message }, err.status as 400);
  }
  if (err instanceof ZodError) {
    return c.json(
      { detail: err.errors.map((e) => ({ loc: e.path, msg: e.message, type: e.code })) },
      422
    );
  }
  console.error("Unhandled error", err);
  return c.json({ detail: "Internal Server Error" }, 500);
});

app.notFound((c) => c.json({ detail: "Not Found" }, 404));

app.get("/health", (c) => {
  const settings = getSettings(c.env);
  return c.json({ status: "ok", app: settings.appName, environment: settings.environment });
});

// Resource routers are mounted here in Phase 2, under the /api prefix that
// backend/app/core/config.py exposed as API_V1_PREFIX.
const api = new Hono<{ Bindings: Bindings }>();

app.route("/api", api);

export default app;
