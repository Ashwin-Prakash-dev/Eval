import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { apiErrorMessage } from "@/lib/api-client";
import type { JudgeCreate, JudgeUpdate } from "@/types/judge";

import { judgesApi } from "./api";

const judgesKey = ["judges"];
const statsKey = ["judges", "stats"];

export function useJudges(search?: string) {
  return useQuery({ queryKey: [...judgesKey, search], queryFn: () => judgesApi.list(search) });
}

export function useJudgeStats() {
  return useQuery({ queryKey: statsKey, queryFn: judgesApi.stats });
}

function useInvalidateJudges() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: judgesKey });
    qc.invalidateQueries({ queryKey: statsKey });
  };
}

export function useCreateJudge() {
  const invalidate = useInvalidateJudges();
  return useMutation({
    mutationFn: (payload: JudgeCreate) => judgesApi.create(payload),
    onSuccess: () => {
      invalidate();
      toast.success("Judge account created");
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not create judge")),
  });
}

export function useUpdateJudge() {
  const invalidate = useInvalidateJudges();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: JudgeUpdate }) => judgesApi.update(id, payload),
    onSuccess: () => {
      invalidate();
      toast.success("Judge updated");
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not update judge")),
  });
}

export function useToggleJudgeActive() {
  const invalidate = useInvalidateJudges();
  return useMutation({
    mutationFn: ({ id, activate }: { id: number; activate: boolean }) =>
      activate ? judgesApi.reactivate(id) : judgesApi.deactivate(id),
    onSuccess: (_data, variables) => {
      invalidate();
      toast.success(variables.activate ? "Judge reactivated" : "Judge deactivated");
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not update judge status")),
  });
}

export function useResetJudgePassword() {
  return useMutation({
    mutationFn: ({ id, new_password }: { id: number; new_password: string }) => judgesApi.resetPassword(id, new_password),
    onSuccess: () => toast.success("Password reset"),
    onError: (error) => toast.error(apiErrorMessage(error, "Could not reset password")),
  });
}
