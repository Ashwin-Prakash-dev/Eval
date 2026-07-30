import { CheckCircle2, ClipboardList, Hourglass, PlayCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { formatScore } from "@/lib/utils";
import type { EvaluationStatus } from "@/types/common";

import { useAssignedEvaluations, useJudgeProgress } from "../hooks";

const statusBadge: Record<EvaluationStatus, { label: string; variant: "success" | "secondary" | "outline" }> = {
  completed: { label: "Completed", variant: "success" },
  in_progress: { label: "In progress", variant: "secondary" },
  not_started: { label: "Not started", variant: "outline" },
};

export function JudgeDashboardPage() {
  const navigate = useNavigate();
  const { data: progress, isLoading: progressLoading } = useJudgeProgress();
  const { data: assigned, isLoading: assignedLoading } = useAssignedEvaluations();

  const nextUp = assigned?.find((a) => a.evaluation.status !== "completed");

  return (
    <div>
      <PageHeader
        title="Your reviews"
        description="Evaluate your assigned submissions — progress saves automatically as you go"
        actions={
          nextUp && (
            <Button onClick={() => navigate(`/judge/evaluate/${nextUp.evaluation.id}`)}>
              <PlayCircle className="h-4 w-4" /> Resume reviewing
            </Button>
          )
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Assigned" value={progress?.total_assigned ?? 0} icon={ClipboardList} isLoading={progressLoading} />
        <StatCard
          label="Completed"
          value={progress?.completed ?? 0}
          icon={CheckCircle2}
          isLoading={progressLoading}
          tone="success"
        />
        <StatCard
          label="Pending"
          value={(progress?.in_progress ?? 0) + (progress?.not_started ?? 0)}
          icon={Hourglass}
          isLoading={progressLoading}
          tone="warning"
        />
      </div>

      <Card className="mb-6">
        <CardContent className="p-5">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">Overall progress</span>
            <span className="text-muted-foreground">{progress?.percent_complete ?? 0}%</span>
          </div>
          <Progress value={progress?.percent_complete ?? 0} />
        </CardContent>
      </Card>

      {assignedLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : assigned?.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No submissions assigned yet" description="Check back once the organizers assign reviews to you." />
      ) : (
        <div className="space-y-3">
          {assigned?.map(({ evaluation, submission }) => (
            <Card
              key={evaluation.id}
              className="cursor-pointer transition-colors hover:bg-accent/40"
              onClick={() => navigate(`/judge/evaluate/${evaluation.id}`)}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{submission.project_title}</p>
                  <p className="text-xs text-muted-foreground">{submission.problem_statement?.title ?? "No problem statement"}</p>
                </div>
                <div className="flex items-center gap-3">
                  {evaluation.weighted_overall_score !== null && (
                    <span className="text-sm font-semibold tabular-nums">{formatScore(evaluation.weighted_overall_score)}</span>
                  )}
                  <Badge variant={statusBadge[evaluation.status].variant}>{statusBadge[evaluation.status].label}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
