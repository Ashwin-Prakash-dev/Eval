import { useQuery, useQueryClient } from "@tanstack/react-query";

import { evaluationApi } from "./api";

export const evaluationKeys = {
  assigned: ["evaluations", "assigned"] as const,
  progress: ["evaluations", "progress"] as const,
  detail: (id: number) => ["evaluations", "detail", id] as const,
};

export function useAssignedEvaluations() {
  return useQuery({ queryKey: evaluationKeys.assigned, queryFn: evaluationApi.assigned });
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
    qc.invalidateQueries({ queryKey: evaluationKeys.assigned });
    qc.invalidateQueries({ queryKey: evaluationKeys.progress });
  };
}
