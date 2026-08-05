import { badRequest } from "../http";
import * as assignmentRepo from "../repo/assignment";

export interface GenerateRequest {
  judges_per_submission: number;
  reset_existing: boolean;
}

export interface GenerateResult {
  assignments_created: number;
  submissions_covered: number;
  judges_used: number;
  min_load: number;
  max_load: number;
  warnings: string[];
}

/**
 * Greedy least-loaded assignment generator, ported from
 * backend/app/services/assignment_service.py.
 *
 * For every submission that still needs coverage it picks `judges_per_submission` distinct
 * judges (excluding conflicts), preferring the least-loaded, ties broken by judge id — so
 * the allocation is deterministic. Safe to re-run: submissions that already have enough
 * judges are skipped and existing load seeds the balance.
 */
export async function generateAssignments(
  db: D1Database,
  request: GenerateRequest,
  generatedById: number | null
): Promise<GenerateResult> {
  const warnings: string[] = [];

  if (request.reset_existing) {
    await assignmentRepo.deleteAll(db);
  }

  const { results: submissionRows } = await db
    .prepare("SELECT id FROM submissions ORDER BY id")
    .all<{ id: number }>();
  const submissionIds = submissionRows.map((r) => r.id);

  const { results: judgeRows } = await db
    .prepare("SELECT id FROM users WHERE role = 'judge' AND is_active = 1 ORDER BY id")
    .all<{ id: number }>();
  const judgeIds = judgeRows.map((r) => r.id);

  if (submissionIds.length === 0) throw badRequest("There are no submissions to assign.");
  if (judgeIds.length === 0) throw badRequest("There are no active judges to assign.");
  if (request.judges_per_submission > judgeIds.length) {
    throw badRequest(
      `judges_per_submission (${request.judges_per_submission}) exceeds the number ` +
        `of active judges (${judgeIds.length}).`
    );
  }

  const conflictPairs = await assignmentRepo.allConflictPairs(db);
  const assignedBySubmission = await assignmentRepo.allAssignmentPairs(db);

  const load = new Map<number, number>(judgeIds.map((id) => [id, 0]));
  for (const [judgeId, count] of await assignmentRepo.loadCountsByJudge(db)) {
    if (load.has(judgeId)) load.set(judgeId, count);
  }

  const newPairs: [number, number][] = [];

  for (const sid of submissionIds) {
    const already = assignedBySubmission.get(sid) ?? new Set<number>();
    const need = request.judges_per_submission - already.size;
    if (need <= 0) continue;

    const eligible = judgeIds.filter((j) => !already.has(j) && !conflictPairs.has(`${sid}:${j}`));
    if (eligible.length < need) {
      warnings.push(
        `Submission #${sid}: only ${eligible.length} eligible judge(s) available ` +
          `(needed ${need}); assigned as many as possible.`
      );
    }
    eligible.sort((a, b) => (load.get(a)! - load.get(b)!) || a - b);
    const chosen = eligible.slice(0, need);

    for (const jid of chosen) {
      newPairs.push([sid, jid]);
      load.set(jid, load.get(jid)! + 1);
      const set = assignedBySubmission.get(sid) ?? new Set<number>();
      set.add(jid);
      assignedBySubmission.set(sid, set);
    }
  }

  const created = await assignmentRepo.bulkCreate(db, newPairs, generatedById);

  const finalLoads = [...load.values()];
  return {
    assignments_created: created,
    submissions_covered: submissionIds.length,
    judges_used: judgeIds.length,
    min_load: finalLoads.length ? Math.min(...finalLoads) : 0,
    max_load: finalLoads.length ? Math.max(...finalLoads) : 0,
    warnings,
  };
}
