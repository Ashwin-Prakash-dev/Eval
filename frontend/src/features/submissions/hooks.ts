import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { apiErrorMessage } from "@/lib/api-client";
import type { FileKind } from "@/types/common";
import type { SubmissionCreate, SubmissionUpdate } from "@/types/submission";

import { problemStatementsApi, submissionsApi, type SubmissionListParams } from "./api";

export const submissionKeys = {
  all: ["submissions"] as const,
  list: (params: SubmissionListParams) => ["submissions", "list", params] as const,
  detail: (id: number) => ["submissions", "detail", id] as const,
};

export function useSubmissions(params: SubmissionListParams) {
  return useQuery({ queryKey: submissionKeys.list(params), queryFn: () => submissionsApi.list(params) });
}

export function useSubmission(id: number | undefined) {
  return useQuery({
    queryKey: submissionKeys.detail(id!),
    queryFn: () => submissionsApi.get(id!),
    enabled: id !== undefined,
  });
}

export function useCreateSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SubmissionCreate) => submissionsApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: submissionKeys.all });
      toast.success("Submission created");
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not create submission")),
  });
}

export function useUpdateSubmission(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SubmissionUpdate) => submissionsApi.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: submissionKeys.all });
      toast.success("Submission updated");
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not update submission")),
  });
}

export function useDeleteSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => submissionsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: submissionKeys.all });
      toast.success("Submission deleted");
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not delete submission")),
  });
}

export function useUploadSubmissionFile(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, file }: { kind: FileKind; file: File }) => submissionsApi.uploadFile(id, kind, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: submissionKeys.detail(id) });
      toast.success("File uploaded");
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Upload failed")),
  });
}

export function useBulkImportSubmissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => submissionsApi.bulkImport(file),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: submissionKeys.all });
      if (result.failed > 0) {
        toast.warning(`Imported ${result.created}, ${result.failed} row(s) failed`);
      } else {
        toast.success(`Imported ${result.created} submissions`);
      }
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Bulk import failed")),
  });
}

export function useProblemStatements() {
  return useQuery({ queryKey: ["problem-statements"], queryFn: problemStatementsApi.list });
}

export function useCreateProblemStatement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: problemStatementsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["problem-statements"] });
      toast.success("Problem statement created");
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not create problem statement")),
  });
}

export function useDeleteProblemStatement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => problemStatementsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["problem-statements"] });
      toast.success("Problem statement deleted");
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not delete — it may still have submissions")),
  });
}
