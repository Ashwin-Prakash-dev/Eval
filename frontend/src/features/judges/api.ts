import { apiClient } from "@/lib/api-client";
import type { UserRole } from "@/types/common";
import type {
  AllowedEmailBulkResult,
  AllowedEmailCreate,
  AllowedEmailOut,
  AllowedEmailUpdate,
  JudgeOut,
  JudgeStats,
  JudgeUpdate,
} from "@/types/judge";

export const judgesApi = {
  list: (search?: string) => apiClient.get<JudgeOut[]>("/judges", { params: { search } }).then((r) => r.data),
  stats: () => apiClient.get<JudgeStats[]>("/judges/stats").then((r) => r.data),
  update: (id: number, payload: JudgeUpdate) => apiClient.patch<JudgeOut>(`/judges/${id}`, payload).then((r) => r.data),

  listAllowed: (search?: string) =>
    apiClient.get<AllowedEmailOut[]>("/judges/allowed", { params: { search } }).then((r) => r.data),
  createAllowed: (payload: AllowedEmailCreate) =>
    apiClient.post<AllowedEmailOut>("/judges/allowed", payload).then((r) => r.data),
  bulkCreateAllowed: (emails: string[], role: UserRole = "judge") =>
    apiClient.post<AllowedEmailBulkResult>("/judges/allowed/bulk", { emails, role }).then((r) => r.data),
  updateAllowed: (id: number, payload: AllowedEmailUpdate) =>
    apiClient.patch<AllowedEmailOut>(`/judges/allowed/${id}`, payload).then((r) => r.data),
  deleteAllowed: (id: number) => apiClient.delete(`/judges/allowed/${id}`),
};
