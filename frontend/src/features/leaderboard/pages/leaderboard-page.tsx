import type { ColumnDef } from "@tanstack/react-table";
import { Search, Trophy } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExportMenu } from "@/features/analytics/components/export-menu";
import { useLeaderboard } from "@/features/analytics/hooks";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { cn, formatScore } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import type { LeaderboardEntry } from "@/types/analytics";

/** Sorting by std-dev is offered only to admins, who are the only ones shown the column. */
const sortOptions = [
  { value: "overall_score", label: "Overall score", adminOnly: false },
  { value: "std_dev", label: "Std. deviation", adminOnly: true },
  { value: "reviews_completed", label: "Reviews completed", adminOnly: false },
  { value: "project_title", label: "Project title", adminOnly: false },
];

export function LeaderboardPage() {
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  // Judges see the result; admins additionally see how much the judges diverged, can export,
  // and can click through to a submission. The server strips the extra fields either way --
  // this only decides what is rendered and offered.
  const isAdmin = useAuthStore((s) => s.user?.role) === "admin";
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("overall_score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data, isLoading } = useLeaderboard({
    page,
    page_size: 20,
    search: search || undefined,
    sort_by: sortBy,
    sort_dir: sortDir,
  });

  const debouncedSearch = useDebouncedCallback((value: string) => {
    setPage(1);
    setSearch(value);
  }, 300);

  const columns: ColumnDef<LeaderboardEntry>[] = [
    {
      header: "Rank",
      cell: ({ row }) => (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
          {row.original.rank}
        </span>
      ),
    },
    {
      header: "Project",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.project_title}</p>
        </div>
      ),
    },
    {
      header: "Overall score",
      cell: ({ row }) => <span className="text-base font-semibold tabular-nums">{formatScore(row.original.overall_score)}</span>,
    },
    {
      header: "Criteria",
      cell: ({ row }) => (
        <div className="flex max-w-xs flex-wrap gap-1">
          {Object.entries(row.original.criterion_scores).map(([name, value]) => (
            <Badge key={name} variant="outline" className="whitespace-nowrap">
              {name}: {formatScore(value, 1)}
            </Badge>
          ))}
        </div>
      ),
    },
    ...(isAdmin
      ? ([
          {
            header: "Std dev",
            cell: ({ row }) => formatScore(row.original.std_dev ?? null),
          },
        ] satisfies ColumnDef<LeaderboardEntry>[])
      : []),
    {
      header: "Reviews",
      cell: ({ row }) => row.original.reviews_completed,
    },
    ...(isAdmin
      ? ([
          {
            header: "Flag",
            // Two different problems, two different colours. Red "Disagreement" means the
            // judges scored it very differently; amber "Needs re-review" means the team
            // edited it after it was judged, so there is no score to disagree about until it
            // is reviewed again.
            cell: ({ row }) =>
              row.original.needs_reevaluation ? (
                <Badge variant="warning" className="whitespace-nowrap">
                  Needs re-review
                </Badge>
              ) : row.original.is_flagged ? (
                <Badge variant="destructive">Disagreement</Badge>
              ) : null,
          },
        ] satisfies ColumnDef<LeaderboardEntry>[])
      : []),
  ];

  return (
    <div>
      {/* Export is admin-only server-side, and the report carries per-judge statistics
          (harsh / lenient / high variance), so the button is not offered to judges. */}
      <PageHeader
        title="Leaderboard"
        description="Final rankings across all completed reviews"
        actions={isAdmin ? <ExportMenu /> : undefined}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search projects…" className="pl-8" onChange={(e) => debouncedSearch(e.target.value)} />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sortOptions
              .filter((opt) => isAdmin || !opt.adminOnly)
              .map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  Sort by {opt.label}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}>
          {sortDir === "asc" ? "Ascending" : "Descending"}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        emptyMessage="No completed reviews yet."
        rowClassName={(row) => cn(row.rank <= 3 && "bg-warning/5")}
        // The submission detail page is admin-only, both as a route and as an API. Judges get
        // no row click rather than one that bounces them to their own dashboard.
        onRowClick={isAdmin ? (row) => navigate(`/admin/submissions/${row.submission_id}`) : undefined}
      />

      {data && data.total_pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Trophy className="h-3.5 w-3.5" /> Page {data.page} of {data.total_pages} — {data.total} ranked projects
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= data.total_pages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
