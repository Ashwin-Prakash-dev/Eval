import { apiClient } from "@/lib/api-client";
import type {
  EvaluationAdminOut,
  EvaluationAutosaveRequest,
  EvaluationDetailOut,
  EvaluationOut,
  JudgeProgressOut,
  ReviewableOut,
} from "@/types/evaluation";

export const evaluationApi = {
  reviewable: () => apiClient.get<ReviewableOut[]>("/evaluations/reviewable").then((r) => r.data),
  /**
   * `confirmReset` is required only when the submission was edited after this judge completed
   * their review. Without it the server refuses with a 409 rather than silently discarding
   * their scores, so the judge is always asked before any work is destroyed.
   */
  open: (submissionId: string, confirmReset = false) =>
    apiClient
      .post<EvaluationOut>(
        `/evaluations/open/${submissionId}${confirmReset ? "?confirm_reset=true" : ""}`
      )
      .then((r) => r.data),
  setFlag: (id: number, flagged: boolean) =>
    apiClient
      .patch<EvaluationOut>(`/evaluations/${id}/flag`, { flagged_for_review: flagged })
      .then((r) => r.data),
  progress: () => apiClient.get<JudgeProgressOut>("/evaluations/progress").then((r) => r.data),
  get: (id: number) => apiClient.get<EvaluationDetailOut>(`/evaluations/${id}`).then((r) => r.data),
  autosave: (id: number, payload: EvaluationAutosaveRequest) =>
    apiClient.patch<EvaluationOut>(`/evaluations/${id}`, payload).then((r) => r.data),
  forSubmission: (submissionId: string) =>
    apiClient.get<EvaluationAdminOut[]>(`/evaluations/submission/${submissionId}/all`).then((r) => r.data),
};
