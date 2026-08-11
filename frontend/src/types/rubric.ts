export interface CriterionOut {
  id: number;
  name: string;
  description: string;
  weight: number;
  order_index: number;
}

/**
 * Shape of GET /rubrics/active. The rubric is a server-side constant, so `id`, `is_active`
 * and `created_at` are vestigial -- they are still returned so this contract did not have
 * to change, but nothing reads them.
 */
export interface RubricOut {
  id: number;
  name: string;
  is_active: boolean;
  disagreement_threshold: number;
  created_at: string | null;
  criteria: CriterionOut[];
}
