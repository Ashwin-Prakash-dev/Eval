import { apiClient } from "@/lib/api-client";
import type { RubricCreate, RubricOut, RubricUpdate } from "@/types/rubric";

export const rubricApi = {
  list: () => apiClient.get<RubricOut[]>("/rubrics").then((r) => r.data),
  active: () => apiClient.get<RubricOut>("/rubrics/active").then((r) => r.data),
  create: (payload: RubricCreate) => apiClient.post<RubricOut>("/rubrics", payload).then((r) => r.data),
  update: (id: number, payload: RubricUpdate) => apiClient.patch<RubricOut>(`/rubrics/${id}`, payload).then((r) => r.data),
  activate: (id: number) => apiClient.post<RubricOut>(`/rubrics/${id}/activate`).then((r) => r.data),
  remove: (id: number) => apiClient.delete(`/rubrics/${id}`),
};
