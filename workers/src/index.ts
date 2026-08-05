import { Hono } from "hono";
import { cors } from "hono/cors";
import { ZodError } from "zod";

import { getSettings } from "./env";
import { ApiError, ValidationError } from "./http";
import type { AppEnv } from "./middleware/auth";
import { analyticsRoutes } from "./routes/analytics";
import { assignmentRoutes } from "./routes/assignments";
import { auditLogRoutes } from "./routes/audit_logs";
import { authRoutes } from "./routes/auth";
import { evaluationRoutes } from "./routes/evaluations";
import { exportRoutes } from "./routes/export";
import { judgeRoutes } from "./routes/judges";
import { problemStatementRoutes } from "./routes/problem_statements";
import { rubricRoutes } from "./routes/rubrics";
import { submissionRoutes } from "./routes/submissions";

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
  // 422 with a per-field detail array, matching FastAPI's RequestValidationError handler.
  if (err instanceof ValidationError) {
    return c.json({ detail: err.details }, 422);
  }
  // A ZodError reaching here means a schema was parsed outside parseOrThrow; still report
  // it as a 422 rather than letting it fall through to a 500.
  if (err instanceof ZodError) {
    return c.json(
      { detail: err.errors.map((e) => ({ type: e.code, loc: ["body", ...e.path], msg: e.message })) },
      422
    );
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
api.route("/problem-statements", problemStatementRoutes);
api.route("/submissions", submissionRoutes);
api.route("/rubrics", rubricRoutes);
api.route("/assignments", assignmentRoutes);
api.route("/judges", judgeRoutes);
api.route("/evaluations", evaluationRoutes);
api.route("/analytics", analyticsRoutes);
api.route("/audit-logs", auditLogRoutes);
api.route("/export", exportRoutes);

app.route("/api", api);

export default app;
