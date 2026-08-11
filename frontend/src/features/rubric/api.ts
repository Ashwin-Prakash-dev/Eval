import { apiClient } from "@/lib/api-client";
import type { RubricOut } from "@/types/rubric";

/**
 * The rubric is a deployed constant on the server (workers/src/config/rubric.ts), so this
 * is a read-only resource: there is nothing to create, activate or delete.
 */
export const rubricApi = {
  active: () => apiClient.get<RubricOut>("/rubrics/active").then((r) => r.data),
};
