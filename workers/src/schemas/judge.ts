import { z } from "zod";

const role = z.enum(["admin", "judge"]);

/**
 * Mirrors backend/app/schemas/user.py. Note AllowedEmailUpdate deliberately has no `role`
 * field there, so the approved-email role cannot be changed through this endpoint.
 */
export const allowedEmailCreateSchema = z.object({
  email: z.string().email(),
  role: role.default("judge"),
  full_name: z.string().max(120).nullable().optional(),
  note: z.string().max(255).nullable().optional(),
});

export const allowedEmailUpdateSchema = z.object({
  full_name: z.string().max(120).nullable().optional(),
  note: z.string().max(255).nullable().optional(),
  is_active: z.boolean().nullable().optional(),
});

export const allowedEmailBulkSchema = z.object({
  emails: z.array(z.string().email()).min(1).max(500),
  role: role.default("judge"),
});

export const judgeUpdateSchema = z.object({
  full_name: z.string().max(120).nullable().optional(),
  is_active: z.boolean().nullable().optional(),
});
