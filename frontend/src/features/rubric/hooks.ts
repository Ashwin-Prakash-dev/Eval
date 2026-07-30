import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { apiErrorMessage } from "@/lib/api-client";
import type { RubricCreate, RubricUpdate } from "@/types/rubric";

import { rubricApi } from "./api";

const key = ["rubrics"];

export function useRubrics() {
  return useQuery({ queryKey: key, queryFn: rubricApi.list });
}

export function useCreateRubric() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RubricCreate) => rubricApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast.success("Rubric created");
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not create rubric")),
  });
}

export function useUpdateRubric() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: RubricUpdate }) => rubricApi.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast.success("Rubric updated");
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not update rubric")),
  });
}

export function useActivateRubric() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => rubricApi.activate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast.success("Rubric activated");
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not activate rubric")),
  });
}

export function useDeleteRubric() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => rubricApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast.success("Rubric deleted");
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not delete rubric")),
  });
}
