import { Hono } from "hono";
import { cors } from "hono/cors";
import { ZodError } from "zod";

import { getSettings } from "./env";
import { ApiError } from "./http";
import type { AppEnv } from "./middleware/auth";
import { authRoutes } from "./routes/auth";

const app = new Hono<AppEnv>();

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
    return c.json({ detail: err.message }, err.status as 400, err.headers);
  }
  if (err instanceof ZodError) {
    return c.json(
      { detail: err.errors.map((e) => ({ loc: e.path, msg: e.message, type: e.code })) },
      422
    );
  }
  if (err instanceof SyntaxError) {
    return c.json({ detail: "Invalid JSON body" }, 400);
  }
  console.error(JSON.stringify({ message: "Unhandled error", error: String(err) }));
  return c.json({ detail: "Internal Server Error" }, 500);
});

app.notFound((c) => c.json({ detail: "Not Found" }, 404));

app.get("/health", (c) => {
  const settings = getSettings(c.env);
  return c.json({ status: "ok", app: settings.appName, environment: settings.environment });
});

const api = new Hono<AppEnv>();
api.route("/auth", authRoutes);

app.route("/api", api);

export default app;
