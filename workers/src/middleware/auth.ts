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
  // FastAPI's OAuth2PasswordBearer splits on the first space and lowercases the scheme
  // (RFC 7235 makes it case-insensitive), passing the credential through verbatim. A
  // case-sensitive startsWith would 401 a valid `authorization: bearer <token>`.
  const header = c.req.header("Authorization") ?? "";
  const separator = header.indexOf(" ");
  const scheme = separator === -1 ? header : header.slice(0, separator);
  const token = separator === -1 ? "" : header.slice(separator + 1);
  if (!header || scheme.toLowerCase() !== "bearer" || !token) throw credentialsError();

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
