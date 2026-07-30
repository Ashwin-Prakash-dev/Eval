import { apiClient } from "@/lib/api-client";
import type { JudgeCreate, JudgeOut, JudgeStats, JudgeUpdate } from "@/types/judge";

export const judgesApi = {
  list: (search?: string) => apiClient.get<JudgeOut[]>("/judges", { params: { search } }).then((r) => r.data),
  stats: () => apiClient.get<JudgeStats[]>("/judges/stats").then((r) => r.data),
  create: (payload: JudgeCreate) => apiClient.post<JudgeOut>("/judges", payload).then((r) => r.data),
  update: (id: number, payload: JudgeUpdate) => apiClient.patch<JudgeOut>(`/judges/${id}`, payload).then((r) => r.data),
  deactivate: (id: number) => apiClient.post<JudgeOut>(`/judges/${id}/deactivate`).then((r) => r.data),
  reactivate: (id: number) => apiClient.post<JudgeOut>(`/judges/${id}/reactivate`).then((r) => r.data),
  resetPassword: (id: number, new_password: string) =>
    apiClient.post<JudgeOut>(`/judges/${id}/reset-password`, { new_password }).then((r) => r.data),
};
