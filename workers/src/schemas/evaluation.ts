import { z } from "zod";

/**
 * Scores run 1-10 in half-point steps: 8, 8.5, 9 are all valid, 8.25 is not.
 *
 * The bound is enforced here rather than left to the UI, since the slider is not the only
 * way in -- the API is reachable directly, and `evaluation_scores.score` is a REAL column
 * that would happily store 8.31 and quietly skew every average built on top of it.
 */
export const scoreEntrySchema = z.object({
  criterion_id: z.number().int(),
  score: z.number().gte(1).lte(10).multipleOf(0.5).nullable().optional(),
  comment: z.string().nullable().optional(),
});

export const evaluationAutosaveSchema = z.object({
  scores: z.array(scoreEntrySchema).default([]),
  overall_comment: z.string().nullable().optional(),
  time_spent_delta_seconds: z.number().int().gte(0).default(0),
  mark_complete: z.boolean().nullable().optional(),
});

export const evaluationFlagSchema = z.object({
  flagged_for_review: z.boolean(),
});
