import { Hono } from "hono";

import type { User } from "../db";
import { requireUser, type AppEnv } from "../middleware/auth";
import * as auditRepo from "../repo/audit";
import { otpRequestSchema, otpVerifySchema } from "../schemas/auth";
import * as authService from "../services/auth";

/** Matches UserOut in backend/app/schemas/auth.py. */
export function userOut(user: User) {
  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    is_active: user.is_active,
    created_at: user.created_at,
    last_login: user.last_login,
  };
}

export const authRoutes = new Hono<AppEnv>();

authRoutes.post("/request-otp", async (c) => {
  const payload = otpRequestSchema.parse(await c.req.json());
  return c.json(await authService.requestOtp(c.env, payload.email));
});

authRoutes.post("/verify-otp", async (c) => {
  const payload = otpVerifySchema.parse(await c.req.json());
  const { user, token } = await authService.verifyOtp(c.env, payload.email, payload.code);
  await auditRepo.create(c.env.DB, user.id, "login", "user", user.id, { email: user.email });
  return c.json({ access_token: token, token_type: "bearer", user: userOut(user) });
});

authRoutes.get("/me", requireUser, (c) => c.json(userOut(c.get("user"))));
