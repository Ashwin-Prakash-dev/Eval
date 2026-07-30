import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";

import {
  CriterionAveragesChart,
  JudgeProgressChart,
  ScoreDistributionChart,
  SubmissionDistributionChart,
} from "../components/charts";
import { useAnalyticsOverview } from "../hooks";

export function AnalyticsPage() {
  const { data, isLoading } = useAnalyticsOverview();

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-80 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Analytics" description="Progress, distribution, and scoring trends across the event" />
      <div className="grid gap-4 sm:grid-cols-2">
        <SubmissionDistributionChart data={data.submission_distribution} />
        <JudgeProgressChart data={data.judge_progress} />
        <ScoreDistributionChart data={data.score_distribution} />
        <CriterionAveragesChart data={data.criterion_averages} />
      </div>
    </div>
  );
}
