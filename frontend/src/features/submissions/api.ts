import { apiClient } from "@/lib/api-client";
import type { FileKind, Page } from "@/types/common";
import type {
  BulkImportResult,
  ProblemStatement,
  ProblemStatementCreate,
  ProblemStatementUpdate,
  SubmissionCreate,
  SubmissionOut,
  SubmissionUpdate,
} from "@/types/submission";

export interface SubmissionListParams {
  page: number;
  page_size: number;
  search?: string;
  problem_statement_id?: number;
}

export const submissionsApi = {
  list: (params: SubmissionListParams) =>
    apiClient.get<Page<SubmissionOut>>("/submissions", { params }).then((r) => r.data),
  get: (id: number) => apiClient.get<SubmissionOut>(`/submissions/${id}`).then((r) => r.data),
  create: (payload: SubmissionCreate) => apiClient.post<SubmissionOut>("/submissions", payload).then((r) => r.data),
  update: (id: number, payload: SubmissionUpdate) =>
    apiClient.patch<SubmissionOut>(`/submissions/${id}`, payload).then((r) => r.data),
  remove: (id: number) => apiClient.delete(`/submissions/${id}`),
  uploadFile: (id: number, kind: FileKind, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return apiClient
      .post<SubmissionOut>(`/submissions/${id}/upload/${kind}`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },
  bulkImport: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return apiClient
      .post<BulkImportResult>("/submissions/bulk-import", form, { headers: { "Content-Type": "multipart/form-data" } })
      .then((r) => r.data);
  },
  fileUrl: (id: number, kind: FileKind) => `/submissions/${id}/file/${kind}`,
};

export const problemStatementsApi = {
  list: () => apiClient.get<ProblemStatement[]>("/problem-statements").then((r) => r.data),
  create: (payload: ProblemStatementCreate) =>
    apiClient.post<ProblemStatement>("/problem-statements", payload).then((r) => r.data),
  update: (id: number, payload: ProblemStatementUpdate) =>
    apiClient.patch<ProblemStatement>(`/problem-statements/${id}`, payload).then((r) => r.data),
  remove: (id: number) => apiClient.delete(`/problem-statements/${id}`),
};
