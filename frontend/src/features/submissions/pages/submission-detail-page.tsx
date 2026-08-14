import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, ChevronUp, RotateCcw, Video } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { ApplicationDetails } from "@/components/shared/application-details";
import { DeckLink, VideoEmbed } from "@/components/shared/media-viewer";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { evaluationApi } from "@/features/evaluation/api";
import { useActiveRubric } from "@/features/rubric/hooks";
import { cn, formatScore } from "@/lib/utils";
import type { EvaluationAdminOut } from "@/types/evaluation";

import { useSubmission } from "../hooks";

export function SubmissionDetailPage() {
  const { id: submissionId } = useParams();
  const navigate = useNavigate();
  const { data: submission, isLoading } = useSubmission(submissionId);
  const { data: evaluations } = useQuery({
    queryKey: ["evaluations", "submission", submissionId],
    queryFn: () => evaluationApi.forSubmission(submissionId!),
    enabled: submissionId !== undefined,
  });
  const { data: rubric } = useActiveRubric();
  const criterionById = new Map((rubric?.criteria ?? []).map((c) => [c.id, c]));

  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const toggle = (evaluationId: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(evaluationId)) {
        next.delete(evaluationId);
      } else {
        next.add(evaluationId);
      }
      return next;
    });

  if (isLoading || !submission) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-2" onClick={() => navigate("/admin/submissions")}>
        <ArrowLeft className="h-4 w-4" /> Back to submissions
      </Button>
      <PageHeader
        title={submission.project_title}
        description={`Team: ${submission.team_identifier}`}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* The application text is the substance being judged, so it takes the wide column;
            the deck and video are reference material in the rail. */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Application</CardTitle>
            </CardHeader>
            <CardContent>
              <ApplicationDetails
                shortDescription={submission.short_description}
                problemEvidence={submission.problem_evidence}
                domains={submission.domains}
                priorWork={submission.prior_work}
                members={submission.members}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Judge evaluations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {!evaluations || evaluations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No judges assigned yet.</p>
              ) : (
                evaluations.map((evaluation) => (
                  <JudgeEvaluationRow
                    key={evaluation.id}
                    evaluation={evaluation}
                    criterionById={criterionById}
                    isExpanded={expanded.has(evaluation.id)}
                    onToggle={() => toggle(evaluation.id)}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-4 w-4" /> Pitch video
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <VideoEmbed url={submission.video_url} />
              <DeckLink url={submission.deck_url} compact />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function JudgeEvaluationRow({
  evaluation,
  criterionById,
  isExpanded,
  onToggle,
}: {
  evaluation: EvaluationAdminOut;
  criterionById: Map<number, { name: string; weight: number }>;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const hasScores = evaluation.scores.some((s) => s.score !== null);

  return (
    <div className="rounded-md border text-sm">
      <button
        type="button"
        onClick={onToggle}
        disabled={!hasScores}
        className="flex w-full items-center justify-between p-3 text-left disabled:cursor-not-allowed"
      >
        <div>
          <p className="font-medium">{evaluation.judge.full_name || evaluation.judge.email}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <Badge
              variant={
                evaluation.needs_reevaluation
                  ? "warning"
                  : evaluation.status === "completed"
                    ? "success"
                    : "secondary"
              }
            >
              {evaluation.status.replace("_", " ")}
            </Badge>
            {/* The team edited the submission after this review was completed, so it counts
                towards nothing until the judge redoes it. Amber, deliberately distinct from
                the red "Disagreement" flag, which means something entirely different. */}
            {evaluation.needs_reevaluation && (
              <Badge variant="warning" className="gap-1">
                <RotateCcw className="h-3 w-3" /> needs re-review
              </Badge>
            )}
            {/* Only the first five completed reviews move the score; the rest are recorded. */}
            {evaluation.status === "completed" &&
              !evaluation.counts_toward_score &&
              !evaluation.needs_reevaluation && <Badge variant="outline">not counted</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold tabular-nums">{formatScore(evaluation.weighted_overall_score)}</span>
          {hasScores && (isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />)}
        </div>
      </button>

      {isExpanded && hasScores && (
        <div className="space-y-3 border-t p-3">
          <div className="space-y-2">
            {evaluation.scores.map((score) => {
              const criterion = criterionById.get(score.criterion_id);
              return (
                <div key={score.criterion_id} className={cn(score.score === null && "opacity-40")}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{criterion?.name ?? `Criterion #${score.criterion_id}`}</span>
                    <span className="tabular-nums text-muted-foreground">{formatScore(score.score, 0)}/10</span>
                  </div>
                  {score.comment && <p className="mt-0.5 text-xs italic text-muted-foreground">"{score.comment}"</p>}
                </div>
              );
            })}
          </div>
          {evaluation.overall_comment && (
            <>
              <Separator />
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Overall comment</p>
                <p className="text-sm">{evaluation.overall_comment}</p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
