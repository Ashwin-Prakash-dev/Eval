import { useQuery } from "@tanstack/react-query";

import { rubricApi } from "./api";

const key = ["rubrics"];

/**
 * The rubric never changes at runtime, so this is fetched once and reused. It backs both the
 * judge evaluation form and the admin submission detail view, which maps criterion ids to
 * names.
 */
export function useActiveRubric() {
  return useQuery({ queryKey: [...key, "active"], queryFn: rubricApi.active, retry: false });
}
