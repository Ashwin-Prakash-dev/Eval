import type { ColumnDef } from "@tanstack/react-table";
import { Inbox, Search } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { DataTable } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOpenSubmission } from "@/features/evaluation/hooks";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import type { SubmissionOut } from "@/types/submission";

import { useSubmissions } from "../hooks";

export function SubmissionsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  // Admins may review too (organisers judge as well), so the same open-or-create call the
  // judge dashboard uses gets a button here rather than a second copy of it.
  const openMutation = useOpenSubmission();
  const review = (submissionId: string) => {
    openMutation.mutate(submissionId, {
      onSuccess: (evaluation) => navigate(`/judge/evaluate/${evaluation.id}`),
    });
  };

  const params = {
    page,
    page_size: 20,
    search: search || undefined,
  };
  const { data, isLoading } = useSubmissions(params);

  const debouncedSearch = useDebouncedCallback((value: string) => {
    setPage(1);
    setSearch(value);
  }, 300);

  const columns: ColumnDef<SubmissionOut>[] = [
    {
      accessorKey: "project_title",
      header: "Project",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.project_title}</p>
          <p className="text-xs text-muted-foreground">{row.original.team_identifier}</p>
        </div>
      ),
    },
    {
      header: "Domains",
      cell: ({ row }) => {
        const domains = row.original.domains;
        // null and [] mean different things: never answered vs explicitly none.
        if (domains === null) return <span className="text-muted-foreground">—</span>;
        if (domains.length === 0) return <span className="text-muted-foreground">None declared</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {domains.map((domain) => (
              <Badge key={domain} variant="secondary">
                {domain}
              </Badge>
            ))}
          </div>
        );
      },
    },
    {
      id: "review",
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          disabled={openMutation.isPending}
          onClick={(e) => {
            e.stopPropagation();
            review(row.original.id);
          }}
        >
          Review
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Submissions"
        description="Applications submitted through the startathon portal"
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by project or team…"
            className="pl-8"
            onChange={(e) => debouncedSearch(e.target.value)}
          />
        </div>
      </div>

      {!isLoading && data?.items.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No submissions yet"
          description="Submissions appear here once teams submit their application in the startathon portal."
        />
      ) : (
        <DataTable
          columns={columns}
          data={data?.items ?? []}
          isLoading={isLoading}
          onRowClick={(row) => navigate(`/admin/submissions/${row.id}`)}
        />
      )}

      {data && data.total_pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {data.page} of {data.total_pages} — {data.total} submissions
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.total_pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
