import { CheckCircle2, ClipboardList, Gauge, Trophy, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatScore } from "@/lib/utils";

import { ExportMenu } from "../components/export-menu";
import { useAnalyticsOverview } from "../hooks";

export function AdminDashboardPage() {
  const { data, isLoading } = useAnalyticsOverview();
  const stats = data?.stats;

  return (
    <div>
      <PageHeader title="Dashboard" description="A live snapshot of the judging process" actions={<ExportMenu />} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Submissions" value={stats?.total_submissions ?? 0} icon={ClipboardList} isLoading={isLoading} />
        <StatCard label="Judges" value={stats?.total_judges ?? 0} icon={UsersRound} isLoading={isLoading} />
        <StatCard label="Total reviews" value={stats?.total_reviews ?? 0} icon={Gauge} isLoading={isLoading} />
        <StatCard
          label="Completed"
          value={stats?.completed_reviews ?? 0}
          icon={CheckCircle2}
          isLoading={isLoading}
          tone="success"
        />
        <StatCard label="Pending" value={stats?.pending_reviews ?? 0} icon={Gauge} isLoading={isLoading} tone="warning" />
        <StatCard
          label="Average score"
          value={stats?.average_score !== undefined ? formatScore(stats?.average_score) : "—"}
          icon={Trophy}
          isLoading={isLoading}
        />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Leaderboard preview</CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/leaderboard">View full leaderboard</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {data?.leaderboard_preview.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">No completed reviews yet.</p>
          )}
          {data?.leaderboard_preview.map((entry) => (
            <div key={entry.submission_id} className="flex items-center justify-between rounded-md border p-3 text-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
                  {entry.rank}
                </span>
                <div>
                  <p className="font-medium">{entry.project_title}</p>
                  <p className="text-xs text-muted-foreground">{entry.problem_statement ?? "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {entry.is_flagged && <Badge variant="destructive">Disagreement</Badge>}
                <span className="text-base font-semibold tabular-nums">{formatScore(entry.overall_score)}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
