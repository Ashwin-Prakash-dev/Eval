import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { apiErrorMessage } from "@/lib/api-client";
import type { UserRole } from "@/types/common";
import type { AllowedEmailCreate, AllowedEmailUpdate } from "@/types/judge";

import { judgesApi } from "./api";

const judgesKey = ["judges"];
const statsKey = ["judges", "stats"];
const allowedKey = ["judges", "allowed"];

export function useJudges(search?: string) {
  return useQuery({ queryKey: [...judgesKey, search], queryFn: () => judgesApi.list(search) });
}

export function useJudgeStats() {
  return useQuery({ queryKey: statsKey, queryFn: judgesApi.stats });
}

export function useAllowedEmails(search?: string) {
  return useQuery({ queryKey: [...allowedKey, search], queryFn: () => judgesApi.listAllowed(search) });
}

function useInvalidateAccess() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: judgesKey });
  };
}

export function useApproveEmail() {
  const invalidate = useInvalidateAccess();
  return useMutation({
    mutationFn: (payload: AllowedEmailCreate) => judgesApi.createAllowed(payload),
    onSuccess: (entry) => {
      invalidate();
      toast.success(`${entry.email} can now sign in`);
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not approve that email")),
  });
}

export function useBulkApproveEmails() {
  const invalidate = useInvalidateAccess();
  return useMutation({
    mutationFn: ({ emails, role }: { emails: string[]; role?: UserRole }) => judgesApi.bulkCreateAllowed(emails, role),
    onSuccess: (result) => {
      invalidate();
      if (result.skipped > 0) {
        toast.warning(`Approved ${result.created}; ${result.skipped} already on the list`);
      } else {
        toast.success(`Approved ${result.created} email${result.created === 1 ? "" : "s"}`);
      }
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Bulk approval failed")),
  });
}

export function useUpdateAllowedEmail() {
  const invalidate = useInvalidateAccess();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: AllowedEmailUpdate }) => judgesApi.updateAllowed(id, payload),
    onSuccess: (entry) => {
      invalidate();
      toast.success(entry.is_active ? "Access restored" : "Access suspended");
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not update access")),
  });
}

export function useRevokeEmail() {
  const invalidate = useInvalidateAccess();
  return useMutation({
    mutationFn: (id: number) => judgesApi.deleteAllowed(id),
    onSuccess: () => {
      invalidate();
      toast.success("Access revoked");
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not revoke access")),
  });
}
