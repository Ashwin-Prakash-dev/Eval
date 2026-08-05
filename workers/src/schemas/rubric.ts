import { z } from "zod";

/** Mirrors backend/app/schemas/rubric.py. */
export const criterionInputSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().default(""),
  weight: z.number().gt(0).lte(100),
  order_index: z.number().int().default(0),
});

/** Pydantic rounded the sum to 2dp before comparing, so float drift does not reject. */
function weightsTotal100(criteria: { weight: number }[]): boolean {
  return Math.round(criteria.reduce((sum, c) => sum + c.weight, 0) * 100) / 100 === 100;
}

const weightsMessage = (criteria: { weight: number }[]) =>
  `Criterion weights must total 100%, got ${Math.round(criteria.reduce((s, c) => s + c.weight, 0) * 100) / 100}%`;

export const rubricCreateSchema = z
  .object({
    name: z.string().min(1).max(120),
    disagreement_threshold: z.number().gt(0).lte(10).default(1.5),
    criteria: z.array(criterionInputSchema).min(1),
  })
  .superRefine((data, ctx) => {
    if (!weightsTotal100(data.criteria)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["criteria"], message: weightsMessage(data.criteria) });
    }
  });

export const rubricUpdateSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    disagreement_threshold: z.number().gt(0).lte(10).optional(),
    is_active: z.boolean().optional(),
    criteria: z.array(criterionInputSchema).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.criteria !== undefined && !weightsTotal100(data.criteria)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["criteria"], message: weightsMessage(data.criteria) });
    }
  });

export type CriterionInput = z.infer<typeof criterionInputSchema>;
