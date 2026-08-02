import type { EvaluationStatus } from "@/types/common";

export const EVALUATION_STATUS_BADGE: Record<
  EvaluationStatus,
  { label: string; variant: "success" | "secondary" | "outline" }
> = {
  completed: { label: "Completed", variant: "success" },
  in_progress: { label: "In progress", variant: "secondary" },
  not_started: { label: "Not started", variant: "outline" },
};
