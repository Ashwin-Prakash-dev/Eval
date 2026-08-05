import { z } from "zod";

/** Mirrors backend/app/schemas/rubric.py. */
export const criterionInputSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().default(""),
  weight: z.number().gt(0).lte(100),
  order_index: z.number().int().default(0),
});

/** Pydantic rounded the sum to 2dp before comparing, so float drift does not reject. */
function weightsTotal(criteria: { weight: number }[]): number {
  return Math.round(criteria.reduce((sum, c) => sum + c.weight, 0) * 100) / 100;
}

function weightsTotal100(criteria: { weight: number }[]): boolean {
  return weightsTotal(criteria) === 100;
}

/**
 * The message is rendered exactly as Pydantic did, because the frontend prints `detail`
 * verbatim. `weight` is a Python float so an integral total renders as "90.0", except for
 * an empty list where `sum([])` returns the int 0 and renders as "0". Pydantic v2 also
 * prefixes any ValueError raised inside a validator with "Value error, ".
 */
function weightsMessage(criteria: { weight: number }[]): string {
  const total = weightsTotal(criteria);
  const rendered =
    criteria.length === 0 ? "0" : Number.isInteger(total) ? total.toFixed(1) : String(total);
  return `Value error, Criterion weights must total 100%, got ${rendered}%`;
}

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

/**
 * `criteria` accepts an explicit null: RubricUpdate declared it `list | None`, so a null
 * validated and `if data.criteria is not None` skipped the replacement, leaving the
 * existing criteria intact and returning 200.
 */
export const rubricUpdateSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    disagreement_threshold: z.number().gt(0).lte(10).optional(),
    is_active: z.boolean().optional(),
    criteria: z.array(criterionInputSchema).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.criteria != null && !weightsTotal100(data.criteria)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["criteria"], message: weightsMessage(data.criteria) });
    }
  });

export type CriterionInput = z.infer<typeof criterionInputSchema>;
