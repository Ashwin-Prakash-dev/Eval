import { useQuery } from "@tanstack/react-query";

import { submissionsApi, type SubmissionListParams } from "./api";

export const submissionKeys = {
  all: ["submissions"] as const,
  list: (params: SubmissionListParams) => ["submissions", "list", params] as const,
  detail: (id: string) => ["submissions", "detail", id] as const,
};

export function useSubmissions(params: SubmissionListParams) {
  return useQuery({ queryKey: submissionKeys.list(params), queryFn: () => submissionsApi.list(params) });
}

export function useSubmission(id: string | undefined) {
  return useQuery({
    queryKey: submissionKeys.detail(id!),
    queryFn: () => submissionsApi.get(id!),
    enabled: id !== undefined,
  });
}
