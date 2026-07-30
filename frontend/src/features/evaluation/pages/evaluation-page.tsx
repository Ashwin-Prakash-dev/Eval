import { ArrowLeft, ArrowRight, CheckCircle2, LayoutList } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { PdfViewer, PptAsset, VideoPlayer } from "@/components/shared/media-viewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { EvaluationDetailOut } from "@/types/evaluation";

import { evaluationApi } from "../api";
import { CriterionScoreInput } from "../components/criterion-score-input";
import { SaveStatusIndicator } from "../components/save-status-indicator";
import { useAssignedEvaluations, useEvaluationDetail } from "../hooks";
import { useEvaluationAutosave } from "../use-evaluation-autosave";

export function EvaluationPage() {
  const { evaluationId } = useParams();
  const id = Number(evaluationId);

  const { data, isLoading } = useEvaluationDetail(id);
  const { data: assignedList } = useAssignedEvaluations();

  if (isLoading || !data) {
    return (
      <div className="grid gap-6 lg:grid-cols-5">
        <Skeleton className="h-96 lg:col-span-3" />
        <Skeleton className="h-96 lg:col-span-2" />
      </div>
    );
  }

  return <EvaluationWorkspace key={id} evaluationId={id} data={data} assignedList={assignedList} />;
}

function EvaluationWorkspace({
  evaluationId,
  data,
  assignedList,
}: {
  evaluationId: number;
  data: EvaluationDetailOut;
  assignedList: EvaluationDetailOut[] | undefined;
}) {
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState(0);
  const { submission, criteria } = data;
  const autosave = useEvaluationAutosave(evaluationId, criteria, data.evaluation);

  const { currentPosition, prevId, nextId, remaining } = useMemo(() => {
    if (!assignedList) return { currentPosition: 0, prevId: null, nextId: null, remaining: 0 };
    const idx = assignedList.findIndex((a) => a.evaluation.id === evaluationId);
    return {
      currentPosition: idx + 1,
      prevId: idx > 0 ? assignedList[idx - 1].evaluation.id : null,
      nextId: idx >= 0 && idx < assignedList.length - 1 ? assignedList[idx + 1].evaluation.id : null,
      remaining: assignedList.filter((a) => a.evaluation.status !== "completed").length,
    };
  }, [assignedList, evaluationId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;

      if (e.key >= "0" && e.key <= "9") {
        const value = e.key === "0" ? 10 : Number(e.key);
        const criterion = criteria[activeIndex];
        if (criterion) autosave.updateScore(criterion.id, value);
      } else if (e.key === "ArrowDown") {
        setActiveIndex((i) => Math.min(i + 1, criteria.length - 1));
      } else if (e.key === "ArrowUp") {
        setActiveIndex((i) => Math.max(i - 1, 0));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [criteria, activeIndex, autosave]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={!prevId} onClick={() => prevId && navigate(`/judge/evaluate/${prevId}`)}>
            <ArrowLeft className="h-4 w-4" /> Previous
          </Button>
          <Button variant="outline" size="sm" disabled={!nextId} onClick={() => nextId && navigate(`/judge/evaluate/${nextId}`)}>
            Next <ArrowRight className="h-4 w-4" />
          </Button>
          <span className="ml-2 flex items-center gap-1.5 text-sm text-muted-foreground">
            <LayoutList className="h-4 w-4" />
            {currentPosition} of {assignedList?.length ?? "…"} · {remaining} remaining
          </span>
        </div>
        <SaveStatusIndicator status={autosave.status} onRetry={autosave.retry} />
      </div>

      <div className="mb-4">
        <Progress value={assignedList ? (currentPosition / assignedList.length) * 100 : 0} />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>{submission.project_title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <VideoPlayer
                videoType={submission.video_type}
                videoUrl={submission.video_url}
                filePath={evaluationApi.fileUrl(evaluationId, "video")}
                hasFile={submission.has_video_file}
              />
              <div>
                {submission.problem_statement && (
                  <p className="mb-1 text-sm font-medium text-primary">{submission.problem_statement.title}</p>
                )}
                <p className="text-sm">{submission.short_description}</p>
                {submission.additional_notes && (
                  <p className="mt-2 text-sm text-muted-foreground">{submission.additional_notes}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Slide deck / PDF</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <PdfViewer path={evaluationApi.fileUrl(evaluationId, "pdf")} hasFile={submission.has_pdf} />
              <PptAsset path={evaluationApi.fileUrl(evaluationId, "ppt")} hasFile={submission.has_ppt} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {autosave.scoredCount}/{autosave.totalCriteria} criteria scored — press 1–9/0 to score the highlighted criterion
            </p>
            {autosave.isCompleted && (
              <Badge variant="success" className="gap-1">
                <CheckCircle2 className="h-3 w-3" /> Completed
              </Badge>
            )}
          </div>

          {criteria.map((criterion, index) => (
            <div
              key={criterion.id}
              tabIndex={0}
              onFocus={() => setActiveIndex(index)}
              className={index === activeIndex ? "rounded-lg ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}
            >
              <CriterionScoreInput
                criterion={criterion}
                score={autosave.scores[criterion.id]?.score ?? null}
                comment={autosave.scores[criterion.id]?.comment ?? ""}
                onScoreChange={(score) => autosave.updateScore(criterion.id, score)}
                onCommentChange={(comment) => autosave.updateComment(criterion.id, comment)}
              />
            </div>
          ))}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Overall comment</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={3}
                placeholder="Overall thoughts on this submission (optional)"
                value={autosave.overallComment}
                onChange={(e) => autosave.updateOverallComment(e.target.value)}
              />
            </CardContent>
          </Card>

          <Button
            className="w-full"
            size="lg"
            variant={autosave.isCompleted ? "outline" : "default"}
            onClick={() => autosave.toggleComplete(!autosave.isCompleted)}
          >
            {autosave.isCompleted ? "Mark as in progress" : "Mark evaluation as complete"}
          </Button>
        </div>
      </div>
    </div>
  );
}
