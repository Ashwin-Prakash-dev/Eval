import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileText, Presentation, Upload, Video } from "lucide-react";
import { useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { PdfViewer, PptAsset, VideoPlayer } from "@/components/shared/media-viewer";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { evaluationApi } from "@/features/evaluation/api";
import { formatScore } from "@/lib/utils";

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

  const pptRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const handleUpload = (kind: "ppt" | "pdf" | "video") => (e: React.ChangeEvent<HTMLInputElement>) => {
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
              <CardTitle>Judge scores</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!evaluations || evaluations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No judges assigned yet.</p>
              ) : (
                evaluations.map((evaluation) => (
                  <div key={evaluation.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                    <div>
                      <p className="font-medium">{evaluation.judge.full_name || evaluation.judge.username}</p>
                      <Badge variant={evaluation.status === "completed" ? "success" : "secondary"} className="mt-1">
                        {evaluation.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <p className="text-lg font-semibold tabular-nums">{formatScore(evaluation.weighted_overall_score)}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
