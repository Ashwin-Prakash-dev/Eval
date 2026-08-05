import { createMiddleware } from "hono/factory";

import type { User } from "../db";
import { ApiError, forbidden } from "../http";
import { decodeAccessToken } from "../lib/jwt";
import * as userRepo from "../repo/user";

export interface AuthVariables {
  user: User;
}

export type AppEnv = { Bindings: Env; Variables: AuthVariables };

/**
 * Mirrors backend/app/api/deps.py get_current_user: the token is decoded, then the user is
 * re-loaded from the database and re-checked for is_active on every request, so revoking
 * access takes effect immediately rather than at token expiry.
 */
const credentialsError = () =>
  new ApiError(401, "Could not validate credentials", { "WWW-Authenticate": "Bearer" });

export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw credentialsError();

  const payload = await decodeAccessToken(token, c.env.JWT_SECRET_KEY);
  if (!payload?.sub) throw credentialsError();

  const user = await userRepo.getByEmail(c.env.DB, payload.sub);
  if (!user || !user.is_active) throw credentialsError();

  c.set("user", user);
  await next();
});

export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  if (c.get("user").role !== "admin") throw forbidden("Administrator access required");
  await next();
});

export const requireJudge = createMiddleware<AppEnv>(async (c, next) => {
  if (c.get("user").role !== "judge") throw forbidden("Judge access required");
  await next();
});
