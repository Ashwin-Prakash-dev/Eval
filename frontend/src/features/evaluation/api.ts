import { apiClient } from "@/lib/api-client";
import type { FileKind } from "@/types/common";
import type { EvaluationAdminOut, EvaluationAutosaveRequest, EvaluationDetailOut, EvaluationOut, JudgeProgressOut } from "@/types/evaluation";

export const evaluationApi = {
  assigned: () => apiClient.get<EvaluationDetailOut[]>("/evaluations/assigned").then((r) => r.data),
  progress: () => apiClient.get<JudgeProgressOut>("/evaluations/progress").then((r) => r.data),
  get: (id: number) => apiClient.get<EvaluationDetailOut>(`/evaluations/${id}`).then((r) => r.data),
  autosave: (id: number, payload: EvaluationAutosaveRequest) =>
    apiClient.patch<EvaluationOut>(`/evaluations/${id}`, payload).then((r) => r.data),
  fileUrl: (id: number, kind: FileKind) => `/evaluations/${id}/file/${kind}`,
  forSubmission: (submissionId: number) =>
    apiClient.get<EvaluationAdminOut[]>(`/evaluations/submission/${submissionId}/all`).then((r) => r.data),
};
