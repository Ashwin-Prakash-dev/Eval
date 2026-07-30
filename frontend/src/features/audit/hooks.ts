import { useQuery } from "@tanstack/react-query";

import { auditApi } from "./api";

export function useAuditLogs(page: number, pageSize: number, entityType?: string) {
  return useQuery({
    queryKey: ["audit-logs", page, pageSize, entityType],
    queryFn: () => auditApi.list(page, pageSize, entityType),
  });
}
