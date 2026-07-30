import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { apiErrorMessage } from "@/lib/api-client";
import type { ConflictExclusionCreate, GenerateAssignmentsRequest, ManualAssignmentCreate } from "@/types/assignment";

import { assignmentsApi } from "./api";

const key = ["assignments"];
const conflictsKey = ["assignments", "conflicts"];

export function useAssignments(params?: { judge_id?: number; submission_id?: number }) {
  return useQuery({ queryKey: [...key, params], queryFn: () => assignmentsApi.list(params) });
}

export function useGenerateAssignments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: GenerateAssignmentsRequest) => assignmentsApi.generate(payload),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: key });
      toast.success(`Generated ${result.assignments_created} new assignment(s)`);
      result.warnings.forEach((w) => toast.warning(w));
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not generate assignments")),
  });
}

export function useCreateManualAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ManualAssignmentCreate) => assignmentsApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast.success("Assignment created");
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not create assignment")),
  });
}

export function useDeleteAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => assignmentsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast.success("Assignment removed");
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not remove assignment")),
  });
}

export function useConflicts() {
  return useQuery({ queryKey: conflictsKey, queryFn: assignmentsApi.listConflicts });
}

export function useCreateConflict() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ConflictExclusionCreate) => assignmentsApi.createConflict(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: conflictsKey });
      toast.success("Conflict exclusion added");
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not add conflict exclusion")),
  });
}

export function useDeleteConflict() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => assignmentsApi.removeConflict(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: conflictsKey });
      toast.success("Conflict exclusion removed");
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not remove conflict exclusion")),
  });
}
