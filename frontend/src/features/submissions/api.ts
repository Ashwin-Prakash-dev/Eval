import { apiClient } from "@/lib/api-client";
import type { Page } from "@/types/common";
import type { SubmissionOut } from "@/types/submission";

export interface SubmissionListParams {
  page: number;
  page_size: number;
  search?: string;
}

/** Read-only: submissions are owned by the startathon system. */
export const submissionsApi = {
  list: (params: SubmissionListParams) =>
    apiClient.get<Page<SubmissionOut>>("/submissions", { params }).then((r) => r.data),
  get: (id: string) => apiClient.get<SubmissionOut>(`/submissions/${id}`).then((r) => r.data),
};
