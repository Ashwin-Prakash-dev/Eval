import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, ChevronUp, FileText, Presentation, Upload, Video } from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { PdfViewer, PptAsset, VideoPlayer } from "@/components/shared/media-viewer";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { evaluationApi } from "@/features/evaluation/api";
import { useActiveRubric } from "@/features/rubric/hooks";
import { cn, formatScore } from "@/lib/utils";
import type { FileKind } from "@/types/common";
import type { EvaluationAdminOut } from "@/types/evaluation";

import { submissionsApi } from "../api";
import { useSubmission, useUploadSubmissionFile } from "../hooks";

export function SubmissionDetailPage() {
  const { id } = useParams();
  const submissionId = Number(id);
  const navigate = useNavigate();
  const { data: submission, isLoading } = useSubmission(submissionId);
  const uploadMutation = useUploadSubmissionFile(submissionId);
  const { data: evaluations } = useQuery({
    queryKey: ["evaluations", "submission", submissionId],
    queryFn: () => evaluationApi.forSubmission(submissionId),
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

  const pptRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const handleUpload = (kind: FileKind) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate({ kind, file });
    e.target.value = "";
  };

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
        description={`Team: ${submission.team_identifier}${submission.problem_statement ? ` · ${submission.problem_statement.title}` : ""}`}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2">
                <Video className="h-4 w-4" /> Pitch video
              </CardTitle>
              {submission.video_type === "upload" && (
                <>
                  <Button size="sm" variant="outline" onClick={() => videoRef.current?.click()} disabled={uploadMutation.isPending}>
                    <Upload className="h-4 w-4" /> {submission.has_video_file ? "Replace" : "Upload"}
                  </Button>
                  <input ref={videoRef} type="file" accept="video/*" className="hidden" onChange={handleUpload("video")} />
                </>
              )}
            </CardHeader>
            <CardContent>
              <VideoPlayer
                videoType={submission.video_type}
                videoUrl={submission.video_url}
                filePath={submissionsApi.fileUrl(submissionId, "video")}
                hasFile={submission.has_video_file}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4" /> PDF deck
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => pdfRef.current?.click()} disabled={uploadMutation.isPending}>
                <Upload className="h-4 w-4" /> {submission.has_pdf ? "Replace" : "Upload"}
              </Button>
              <input ref={pdfRef} type="file" accept=".pdf" className="hidden" onChange={handleUpload("pdf")} />
            </CardHeader>
            <CardContent>
              <PdfViewer path={submissionsApi.fileUrl(submissionId, "pdf")} hasFile={submission.has_pdf} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2">
                <Presentation className="h-4 w-4" /> Slide deck
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => pptRef.current?.click()} disabled={uploadMutation.isPending}>
                <Upload className="h-4 w-4" /> {submission.has_ppt ? "Replace" : "Upload"}
              </Button>
              <input ref={pptRef} type="file" accept=".ppt,.pptx" className="hidden" onChange={handleUpload("ppt")} />
            </CardHeader>
            <CardContent>
              <PptAsset path={submissionsApi.fileUrl(submissionId, "ppt")} hasFile={submission.has_ppt} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>{submission.short_description || <span className="text-muted-foreground">No description provided.</span>}</p>
              {submission.additional_notes && (
                <div>
                  <p className="mb-1 font-medium">Additional notes</p>
                  <p className="text-muted-foreground">{submission.additional_notes}</p>
                </div>
              )}
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
          <Badge variant={evaluation.status === "completed" ? "success" : "secondary"} className="mt-1">
            {evaluation.status.replace("_", " ")}
          </Badge>
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
