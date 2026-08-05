import { z } from "zod";

/** Mirrors backend/app/schemas/auth.py. EmailStr becomes z.string().email(). */
export const otpRequestSchema = z.object({
  email: z.string().email(),
});

export const otpVerifySchema = z.object({
  email: z.string().email(),
  code: z.string().min(4).max(12),
});

export type OtpRequestInput = z.infer<typeof otpRequestSchema>;
export type OtpVerifyInput = z.infer<typeof otpVerifySchema>;
