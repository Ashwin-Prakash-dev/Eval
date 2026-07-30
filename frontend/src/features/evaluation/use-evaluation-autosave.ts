import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import type { CriterionBrief, EvaluationOut, ScoreOut } from "@/types/evaluation";

import { evaluationApi } from "./api";
import { useInvalidateEvaluations } from "./hooks";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface CriterionState {
  score: number | null;
  comment: string;
}

function buildInitialState(criteria: CriterionBrief[], scores: ScoreOut[]): Record<number, CriterionState> {
  const byId = new Map(scores.map((s) => [s.criterion_id, s]));
  const state: Record<number, CriterionState> = {};
  for (const criterion of criteria) {
    const existing = byId.get(criterion.id);
    state[criterion.id] = { score: existing?.score ?? null, comment: existing?.comment ?? "" };
  }
  return state;
}

export function useEvaluationAutosave(evaluationId: number, criteria: CriterionBrief[], evaluation: EvaluationOut) {
  const [scores, setScores] = useState<Record<number, CriterionState>>(() => buildInitialState(criteria, evaluation.scores));
  const [overallComment, setOverallComment] = useState(evaluation.overall_comment ?? "");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [isCompleted, setIsCompleted] = useState(evaluation.status === "completed");

  const pendingSecondsRef = useRef(0);
  const stateRef = useRef({ scores, overallComment });
  stateRef.current = { scores, overallComment };
  const invalidateList = useInvalidateEvaluations();

  useEffect(() => {
    const interval = setInterval(() => {
      if (!document.hidden) pendingSecondsRef.current += 1;
    }, 1000);
    return () => clearInterval(interval);
  }, [evaluationId]);

  const flush = useCallback(
    async (markComplete?: boolean) => {
      const current = stateRef.current;
      const seconds = pendingSecondsRef.current;
      pendingSecondsRef.current = 0;
      setStatus("saving");
      try {
        const result = await evaluationApi.autosave(evaluationId, {
          scores: criteria.map((c) => ({
            criterion_id: c.id,
            score: current.scores[c.id]?.score ?? null,
            comment: current.scores[c.id]?.comment || null,
          })),
          overall_comment: current.overallComment,
          time_spent_delta_seconds: seconds,
          mark_complete: markComplete,
        });
        setStatus("saved");
        if (markComplete !== undefined) {
          setIsCompleted(result.status === "completed");
          invalidateList();
        }
        return result;
      } catch (error) {
        pendingSecondsRef.current += seconds;
        setStatus("error");
        throw error;
      }
    },
    [evaluationId, criteria, invalidateList]
  );

  const debouncedFlush = useDebouncedCallback(() => {
    flush().catch(() => {});
  }, 900);

  const updateScore = (criterionId: number, score: number | null) => {
    setScores((prev) => ({ ...prev, [criterionId]: { ...prev[criterionId], score } }));
    debouncedFlush();
  };

  const updateComment = (criterionId: number, comment: string) => {
    setScores((prev) => ({ ...prev, [criterionId]: { ...prev[criterionId], comment } }));
    debouncedFlush();
  };

  const updateOverallComment = (comment: string) => {
    setOverallComment(comment);
    debouncedFlush();
  };

  const retry = () => {
    flush().catch(() => {});
  };

  const toggleComplete = async (value: boolean) => {
    await flush(value).catch(() => {});
  };

  const scoredCount = useMemo(() => Object.values(scores).filter((s) => s.score !== null).length, [scores]);

  return {
    scores,
    overallComment,
    status,
    isCompleted,
    scoredCount,
    totalCriteria: criteria.length,
    updateScore,
    updateComment,
    updateOverallComment,
    retry,
    toggleComplete,
  };
}
