import { apiClient } from "@/lib/api-client";
import type { Page } from "@/types/common";
import type { SubmissionJudgeOut, SubmissionOut } from "@/types/submission";

export interface SubmissionListParams {
  page: number;
  page_size: number;
  search?: string;
}

/** Read-only: submissions are owned by the startathon system. */
export const submissionsApi = {
  /** Admin only — the paginated catalogue is not exposed to judges. */
  list: (params: SubmissionListParams) =>
    apiClient.get<Page<SubmissionOut>>("/submissions", { params }).then((r) => r.data),
  /**
   * Readable by any reviewer, but the shape depends on who asks: admins get `SubmissionOut`,
   * judges get `SubmissionJudgeOut` without `created_at`/`updated_at`. Typed as the union so
   * callers can only touch what both actually contain — nothing renders those two fields, and
   * a page that started to would need to prove it was admin-only first.
   */
  get: (id: string) =>
    apiClient.get<SubmissionOut | SubmissionJudgeOut>(`/submissions/${id}`).then((r) => r.data),
};
