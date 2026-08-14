import type { ColumnDef } from "@tanstack/react-table";
import { CheckCircle2, CircleSlash, Gauge } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { CoverageSubmission } from "@/types/analytics";

import { CoverageStrip } from "../components/coverage-strip";
import { useCoverage } from "../hooks";

type Filter = "needs" | "all";

/**
 * The organiser's worklist for the one thing open review cannot guarantee: that every
 * submission actually gets enough reviews to be scored.
 *
 * Defaults to "still needs reviews" rather than the full field, because this page exists to
 * be emptied — an organiser opens it to find what to chase, not to browse.
 */
export function CoveragePage() {
  const navigate = useNavigate();
  const { data, isLoading } = useCoverage();
  const [filter, setFilter] = useState<Filter>("needs");

  const rows = (data?.submissions ?? []).filter((s) => (filter === "needs" ? !s.is_scored : true));

  const columns: ColumnDef<CoverageSubmission>[] = [
    {
      header: "Project",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.project_title}</p>
          <p className="text-xs text-muted-foreground">{row.original.team_identifier}</p>
        </div>
      ),
    },
    {
      header: "Reviews",
      cell: ({ row }) => {
        const { completed_reviews } = row.original;
        return (
          <span
            className={cn(
              "text-sm font-medium tabular-nums",
              completed_reviews === 0 && "text-destructive"
            )}
          >
            {completed_reviews} of {data?.scoring_limit ?? 5}
          </span>
        );
      },
    },
    {
      header: "Status",
      // Checked before "Scored": a submission edited after collecting its five reviews has a
      // full count of reviews that no longer apply, and reporting it as scored is exactly the
      // false reassurance this page exists to prevent.
      cell: ({ row }) =>
        row.original.needs_reevaluation ? (
          <Badge variant="warning" className="whitespace-nowrap">
            Edited after review
          </Badge>
        ) : row.original.is_scored ? (
          <Badge variant="success">Scored</Badge>
        ) : row.original.completed_reviews === 0 ? (
          <Badge variant="destructive">No reviews</Badge>
        ) : (
          <Badge variant="secondary">Needs {row.original.needed} more</Badge>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Coverage"
        description="Which submissions still need reviews before they can be scored"
      />

      {isLoading || !data ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <StatCard label="Scored" value={data.fully_scored} icon={CheckCircle2} tone="success" />
            <StatCard
              label="Still short"
              value={data.total_submissions - data.fully_scored}
              icon={Gauge}
              tone="warning"
            />
            <StatCard
              label="No reviews yet"
              value={data.unreviewed}
              icon={CircleSlash}
              tone={data.unreviewed > 0 ? "destructive" : "default"}
            />
          </div>

          <div className="mb-6">
            <CoverageStrip coverage={data} />
          </div>

          <div className="mb-4 flex gap-2">
            <Button
              variant={filter === "needs" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("needs")}
            >
              Still needs reviews
            </Button>
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
            >
              All submissions
            </Button>
          </div>

          <DataTable
            columns={columns}
            data={rows}
            onRowClick={(row) => navigate(`/admin/submissions/${row.id}`)}
          />
        </>
      )}
    </div>
  );
}
