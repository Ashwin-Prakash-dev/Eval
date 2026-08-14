/**
 * The rubric, as a deployed constant rather than database rows.
 *
 * This replaces the `rubrics` + `evaluation_criteria` tables. There was only ever one
 * active rubric, so the whole activate/deactivate machinery existed to manage a single
 * row. Reading it is now a synchronous import instead of a query, which removes the
 * "no active rubric configured" failure mode entirely -- every consumer used to carry a
 * `rubric?.criteria ?? []` fallback for a case that can no longer happen.
 *
 * IMPORTANT: `id` values are load-bearing and MUST NEVER be reused or renumbered. They
 * are already written into `evaluation_scores.criterion_id` and are the keys of the
 * `submission_scores.criterion_means` JSON document. Renumbering silently reattributes
 * historical scores to the wrong criterion. To retire a criterion, delete its entry and
 * leave the id burned.
 *
 * Changing weights or names takes effect on the next deploy. Weights are percentages and
 * are applied as `weight / 100`; scores already recorded are unaffected until the
 * affected submission is rescored.
 */

export interface Criterion {
  id: number;
  name: string;
  description: string;
  weight: number;
  order_index: number;
}

/** Flagging threshold for judge disagreement: std-dev above this marks a submission. */
export const DISAGREEMENT_THRESHOLD = 1.5;

/** Display name for the rubric, kept so GET /rubrics/active keeps its existing shape. */
export const RUBRIC_NAME = "Default Rubric";

export const CRITERIA: readonly Criterion[] = [
  {
    id: 1,
    name: "Innovation",
    description: "Originality and creativity of the idea",
    weight: 30,
    order_index: 0,
  },
  {
    id: 2,
    name: "Technical Capability",
    description: "Overall strength of team members based on provided profiles",
    weight: 25,
    order_index: 1,
  },
  {
    id: 3,
    name: "Feasibility",
    description: "Practicality of building and shipping this solution",
    weight: 20,
    order_index: 2,
  },
  {
    id: 4,
    name: "Impact",
    description: "Potential real-world impact and reach",
    weight: 15,
    order_index: 3,
  },
  {
    id: 5,
    name: "Presentation",
    description: "Clarity and persuasiveness of the pitch",
    weight: 10,
    order_index: 4,
  },
];

/**
 * A bad edit to the table above is caught at module load -- that is, on the first request
 * after a deploy -- rather than silently skewing every weighted score. Duplicate ids would
 * make the lookup maps lossy; weights that do not total 100 would make the weighted overall
 * mean something other than a 0-10 score.
 */
function validate(): void {
  const ids = new Set(CRITERIA.map((c) => c.id));
  if (ids.size !== CRITERIA.length) {
    throw new Error("config/rubric: duplicate criterion id");
  }
  const total = CRITERIA.reduce((sum, c) => sum + c.weight, 0);
  if (Math.abs(total - 100) > 0.001) {
    throw new Error(`config/rubric: criterion weights must total 100, got ${total}`);
  }
}
validate();

/** Criteria in display order, the order the old query's ORDER BY order_index, id produced. */
export const CRITERIA_ORDERED: readonly Criterion[] = [...CRITERIA].sort(
  (a, b) => a.order_index - b.order_index || a.id - b.id
);

export const CRITERION_WEIGHTS: ReadonlyMap<number, number> = new Map(
  CRITERIA.map((c) => [c.id, c.weight])
);

export const CRITERION_NAMES: ReadonlyMap<number, string> = new Map(
  CRITERIA.map((c) => [c.id, c.name])
);
