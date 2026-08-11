export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export type EvaluationStatus = "not_started" | "in_progress" | "completed";
export type UserRole = "admin" | "judge";
