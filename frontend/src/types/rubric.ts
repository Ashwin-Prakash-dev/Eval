export interface CriterionInput {
  name: string;
  description: string;
  weight: number;
  order_index: number;
}

export interface CriterionOut extends CriterionInput {
  id: number;
}

export interface RubricCreate {
  name: string;
  disagreement_threshold: number;
  criteria: CriterionInput[];
}

export interface RubricUpdate {
  name?: string;
  disagreement_threshold?: number;
  is_active?: boolean;
  criteria?: CriterionInput[];
}

export interface RubricOut {
  id: number;
  name: string;
  is_active: boolean;
  disagreement_threshold: number;
  created_at: string;
  criteria: CriterionOut[];
}
