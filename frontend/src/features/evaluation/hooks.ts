import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { apiErrorMessage } from "@/lib/api-client";

import { evaluationApi } from "./api";

export const evaluationKeys = {
  reviewable: ["evaluations", "reviewable"] as const,
  progress: ["evaluations", "progress"] as const,
  detail: (id: number) => ["evaluations", "detail", id] as const,
};

export function useReviewableSubmissions() {
  return useQuery({ queryKey: evaluationKeys.reviewable, queryFn: evaluationApi.reviewable });
}

/** Creates this judge's evaluation on first open, then returns it so the caller can navigate. */
export function useOpenSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (submissionId: string) => evaluationApi.open(submissionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: evaluationKeys.reviewable }),
    onError: (error) => toast.error(apiErrorMessage(error, "Could not open this submission")),
  });
}

export function useToggleFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, flagged }: { id: number; flagged: boolean }) =>
      evaluationApi.setFlag(id, flagged),
    onSuccess: (evaluation) => {
      qc.invalidateQueries({ queryKey: evaluationKeys.reviewable });
      qc.invalidateQueries({ queryKey: evaluationKeys.detail(evaluation.id) });
      qc.invalidateQueries({ queryKey: evaluationKeys.progress });
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not update the flag")),
  });
}

export function useJudgeProgress() {
  return useQuery({ queryKey: evaluationKeys.progress, queryFn: evaluationApi.progress });
}

export function useEvaluationDetail(id: number | undefined) {
  return useQuery({
    queryKey: evaluationKeys.detail(id!),
    queryFn: () => evaluationApi.get(id!),
    enabled: id !== undefined,
  });
}

export function useInvalidateEvaluations() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: evaluationKeys.reviewable });
    qc.invalidateQueries({ queryKey: evaluationKeys.progress });
  };
}
