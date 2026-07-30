import { apiClient } from "@/lib/api-client";
import type {
  AssignmentOut,
  ConflictExclusionCreate,
  ConflictExclusionOut,
  GenerateAssignmentsRequest,
  GenerateAssignmentsResult,
  ManualAssignmentCreate,
} from "@/types/assignment";

export const assignmentsApi = {
  list: (params?: { judge_id?: number; submission_id?: number }) =>
    apiClient.get<AssignmentOut[]>("/assignments", { params }).then((r) => r.data),
  generate: (payload: GenerateAssignmentsRequest) =>
    apiClient.post<GenerateAssignmentsResult>("/assignments/generate", payload).then((r) => r.data),
  create: (payload: ManualAssignmentCreate) => apiClient.post<AssignmentOut>("/assignments", payload).then((r) => r.data),
  remove: (id: number) => apiClient.delete(`/assignments/${id}`),
  listConflicts: () => apiClient.get<ConflictExclusionOut[]>("/assignments/conflicts").then((r) => r.data),
  createConflict: (payload: ConflictExclusionCreate) =>
    apiClient.post<ConflictExclusionOut>("/assignments/conflicts", payload).then((r) => r.data),
  removeConflict: (id: number) => apiClient.delete(`/assignments/conflicts/${id}`),
};
