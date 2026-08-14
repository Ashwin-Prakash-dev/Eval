import type { UserRole } from "@/types/common";

/**
 * Reviewing is reachable at two different URLs.
 *
 * Judges review at /judge/*, inside the judge console. Administrators review at /admin/review/*
 * so they stay in the admin shell -- switching them to the judge console would swap the whole
 * sidebar and branding out from under someone who was mid-task. The pages are the same
 * components either way; only the prefix differs.
 *
 * Every navigation between the worklist and an evaluation therefore has to route through here
 * rather than hard-coding a path, or an admin would be bounced to /judge/* and redirected
 * straight back to their dashboard by ProtectedRoute.
 */
export function reviewListPath(role: UserRole): string {
  return role === "admin" ? "/admin/review" : "/judge/dashboard";
}

export function evaluatePath(role: UserRole, evaluationId: number): string {
  return role === "admin" ? `/admin/review/${evaluationId}` : `/judge/evaluate/${evaluationId}`;
}
