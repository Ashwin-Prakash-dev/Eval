import { apiClient } from "@/lib/api-client";
import type { Page } from "@/types/common";
import type { AuditLogOut } from "@/types/audit";

export const auditApi = {
  list: (page: number, pageSize: number, entityType?: string) =>
    apiClient
      .get<Page<AuditLogOut>>("/audit-logs", { params: { page, page_size: pageSize, entity_type: entityType } })
      .then((r) => r.data),
};
