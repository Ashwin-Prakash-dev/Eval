import { formatDistanceToNow } from "date-fns";
import { Bookmark, CheckCircle2, ClipboardList, Flag, Hourglass, RotateCcw, Search } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { EVALUATION_STATUS_BADGE } from "@/lib/evaluation-status";
import { cn, formatScore } from "@/lib/utils";

import { useJudgeProgress, useOpenSubmission, useReviewableSubmissions, useToggleFlag } from "../hooks";

type Filter = "all" | "unreviewed" | "restale" | "flagged";
type Sort = "need" | "title";

const FILTER_LABELS: Record<Filter, string> = {
  all: "All",
  unreviewed: "Not completed",
  restale: "Needs re-review",
  flagged: "Flagged",
};

export function JudgeDashboardPage() {
  const navigate = useNavigate();
  const { data: progress, isLoading: progressLoading } = useJudgeProgress();
  const { data: reviewable, isLoading: listLoading } = useReviewableSubmissions();
  const openMutation = useOpenSubmission();
  const flagMutation = useToggleFlag();

  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("need");
  const [search, setSearch] = useState("");
  /** The row awaiting confirmation that its invalidated review may be discarded. */
  const [pendingReset, setPendingReset] = useState<{ id: string; title: string } | null>(null);

  // Opening creates the evaluation on first visit, so navigation waits for the id.
  const open = (submissionId: string, existingId: number | null, stale: boolean) => {
    // A stale row cannot take the navigate-straight-there shortcut: the reset that discards
    // the invalidated review happens server-side in the open call, and it must be confirmed
    // first. Going directly to the evaluation would leave the dead scores in place.
    if (stale) {
      const row = (reviewable ?? []).find((r) => r.submission.id === submissionId);
      setPendingReset({ id: submissionId, title: row?.submission.project_title ?? "this submission" });
      return;
    }
    if (existingId !== null) {
      navigate(`/judge/evaluate/${existingId}`);
      return;
    }
    openMutation.mutate(
      { submissionId },
      { onSuccess: (evaluation) => navigate(`/judge/evaluate/${evaluation.id}`) }
    );
  };

  const confirmReset = () => {
    if (!pendingReset) return;
    openMutation.mutate(
      { submissionId: pendingReset.id, confirmReset: true },
      {
        onSuccess: (evaluation) => {
          setPendingReset(null);
          navigate(`/judge/evaluate/${evaluation.id}`);
        },
      }
    );
  };

  const term = search.trim().toLowerCase();
  const visible = (reviewable ?? [])
    .filter((row) => {
      // A stale review is not "completed" for filtering purposes — it is work that has come
      // back, so it belongs in the not-completed list rather than hidden from it.
      if (filter === "unreviewed" && row.evaluation?.status === "completed" && !row.needs_reevaluation)
        return false;
      if (filter === "restale" && !row.needs_reevaluation) return false;
      if (filter === "flagged" && !row.evaluation?.flagged_for_review) return false;
      if (term && !row.submission.project_title.toLowerCase().includes(term)) return false;
      return true;
    })
    .sort((a, b) => {
      if (sort === "title") return a.submission.project_title.localeCompare(b.submission.project_title);
      // Default: the submissions closest to going unscored come first. Nothing is allocated,
      // so this ordering is what produces even coverage — a judge who works top-down is
      // always reviewing the thing that needs it most. Ones this judge has already completed
      // sink to the bottom regardless of their count — unless the team edited the submission
      // since, in which case the review no longer counts and the row rises again.
      const done = (r: typeof a) =>
        r.evaluation?.status === "completed" && !r.needs_reevaluation ? 1 : 0;
      return (
        done(a) - done(b) ||
        a.counted_reviews - b.counted_reviews ||
        a.submission.project_title.localeCompare(b.submission.project_title)
      );
    });

  return (
    <div>
      <PageHeader
        title="Review submissions"
        description="Every submission is open to you — progress saves automatically as you go"
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <StatCard label="Submissions" value={progress?.total_assigned ?? 0} icon={ClipboardList} isLoading={progressLoading} />
        <StatCard
          label="Completed"
          value={progress?.completed ?? 0}
          icon={CheckCircle2}
          isLoading={progressLoading}
          tone="success"
        />
        <StatCard
          label="Remaining"
          value={(progress?.in_progress ?? 0) + (progress?.not_started ?? 0)}
          icon={Hourglass}
          isLoading={progressLoading}
          tone="warning"
        />
        {/* Reviews that came back because the team edited the submission. Shown in place of
            the private bookmark count when there are any, since it is work the judge owes. */}
        {(progress?.needs_reevaluation ?? 0) > 0 ? (
          <StatCard
            label="Needs re-review"
            value={progress?.needs_reevaluation ?? 0}
            icon={RotateCcw}
            isLoading={progressLoading}
            tone="warning"
          />
        ) : (
          <StatCard label="Flagged" value={progress?.flagged ?? 0} icon={Flag} isLoading={progressLoading} />
        )}
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

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects…"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(["all", "unreviewed", "restale", "flagged"] as Filter[]).map((value) => (
            <Button
              key={value}
              variant={filter === value ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(value)}
            >
              {FILTER_LABELS[value]}
            </Button>
          ))}
          <span className="mx-1 w-px self-stretch bg-border" aria-hidden />
          <Button
            variant={sort === "need" ? "default" : "outline"}
            size="sm"
            onClick={() => setSort("need")}
          >
            Needs reviews
          </Button>
          <Button
            variant={sort === "title" ? "default" : "outline"}
            size="sm"
            onClick={() => setSort("title")}
          >
            Title
          </Button>
        </div>
      </div>

      {listLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nothing to show"
          description={
            filter === "all"
              ? "Submissions appear here once teams submit their application."
              : "No submissions match this filter."
          }
        />
      ) : (
        <div className="space-y-3">
          {visible.map(({
            submission,
            evaluation,
            counted_reviews,
            scoring_limit,
            needs_reevaluation,
            submission_updated_at,
          }) => {
            const isFull = counted_reviews >= scoring_limit;
            const alreadyCounts = evaluation?.status === "completed" && !needs_reevaluation;
            return (
              <Card
                key={submission.id}
                className={cn(
                  "cursor-pointer transition-colors hover:bg-accent/40",
                  needs_reevaluation && "border-warning/60 bg-warning/5"
                )}
                onClick={() => open(submission.id, evaluation?.id ?? null, needs_reevaluation)}
              >
                <CardContent className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{submission.project_title}</p>
                    <p className="truncate text-xs text-muted-foreground">{submission.short_description}</p>
                    {needs_reevaluation ? (
                      <p className="mt-1 text-xs font-medium text-warning-foreground/80">
                        The team edited this
                        {submission_updated_at
                          ? ` ${formatDistanceToNow(new Date(submission_updated_at), { addSuffix: true })}`
                          : ""}
                        , after you reviewed it. Your score no longer counts — open it to review
                        the new version.
                      </p>
                    ) : (
                      isFull &&
                      !alreadyCounts && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Already has {scoring_limit} scoring reviews — yours will be recorded but will
                          not affect the score.
                        </p>
                      )
                    )}
                  </div>
                  {/* The count is the reason the list is ordered this way, so it has to be
                      visible: "2 of 5" tells the judge why this row is near the top. */}
                  <div className="w-20 shrink-0 text-right">
                    <p
                      className={cn(
                        "text-sm font-medium tabular-nums",
                        counted_reviews === 0 && "text-destructive"
                      )}
                    >
                      {counted_reviews} of {scoring_limit}
                    </p>
                    <p className="text-xs text-muted-foreground">reviews</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {/* A stale review's score is about to be discarded, so showing it invites
                        the judge to anchor on a number that no longer applies. */}
                    {evaluation?.weighted_overall_score != null && !needs_reevaluation && (
                      <span className="text-sm font-semibold tabular-nums">
                        {formatScore(evaluation.weighted_overall_score)}
                      </span>
                    )}
                    {needs_reevaluation ? (
                      <Badge variant="warning" className="gap-1">
                        <RotateCcw className="h-3 w-3" /> Needs re-review
                      </Badge>
                    ) : (
                      <Badge variant={EVALUATION_STATUS_BADGE[evaluation?.status ?? "not_started"].variant}>
                        {EVALUATION_STATUS_BADGE[evaluation?.status ?? "not_started"].label}
                      </Badge>
                    )}
                    {/* Private to this judge; nothing here is visible to admins or other judges. */}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={evaluation?.flagged_for_review ? "Remove flag" : "Flag for later"}
                      disabled={openMutation.isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (evaluation) {
                          flagMutation.mutate({ id: evaluation.id, flagged: !evaluation.flagged_for_review });
                          return;
                        }
                        // Not opened yet: create the evaluation, then flag it. No confirm
                        // needed — a submission with no evaluation can never be stale.
                        openMutation.mutate(
                          { submissionId: submission.id },
                          {
                            onSuccess: (created) =>
                              flagMutation.mutate({ id: created.id, flagged: true }),
                          }
                        );
                      }}
                    >
                      <Bookmark
                        className={cn(
                          "h-4 w-4",
                          evaluation?.flagged_for_review
                            ? "fill-primary text-primary"
                            : "text-muted-foreground"
                        )}
                      />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* The reset hard-deletes the scores and comments given to the previous version, so it
          is never a side effect of clicking a row. The server refuses without this confirm. */}
      <ConfirmDialog
        open={pendingReset !== null}
        onOpenChange={(next) => !next && setPendingReset(null)}
        title="Start this review again?"
        description={`The team edited "${pendingReset?.title ?? ""}" after you reviewed it, so your scores no longer count towards it. Continuing will permanently discard the scores and comments you gave the previous version, and open a blank review of the new one.`}
        confirmLabel="Discard and review again"
        isLoading={openMutation.isPending}
        onConfirm={confirmReset}
      />
    </div>
  );
}
