import { z } from "zod";

/** Mirrors backend/app/schemas/evaluation.py. */
export const scoreEntrySchema = z.object({
  criterion_id: z.number().int(),
  score: z.number().gte(1).lte(10).nullable().optional(),
  comment: z.string().nullable().optional(),
});

export const evaluationAutosaveSchema = z.object({
  scores: z.array(scoreEntrySchema).default([]),
  overall_comment: z.string().nullable().optional(),
  time_spent_delta_seconds: z.number().int().gte(0).default(0),
  mark_complete: z.boolean().nullable().optional(),
});
