import { z } from "zod";

/** Mirrors backend/app/schemas/assignment.py (reviews_per_judge was removed earlier). */
export const generateAssignmentsSchema = z.object({
  judges_per_submission: z.number().int().gt(0).lte(50),
  reset_existing: z.boolean().default(false),
});

export const manualAssignmentSchema = z.object({
  submission_id: z.number().int(),
  judge_id: z.number().int(),
});

export const conflictExclusionSchema = z.object({
  submission_id: z.number().int(),
  judge_id: z.number().int(),
  reason: z.string().max(255).nullable().optional(),
});

