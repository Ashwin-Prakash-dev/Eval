import type { ColumnDef } from "@tanstack/react-table";
import { FileText, ListTree, MoreHorizontal, Plus, Presentation, Search, Upload, Video } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import type { SubmissionOut } from "@/types/submission";

import { BulkImportDialog } from "../components/bulk-import-dialog";
import { ProblemStatementsDialog } from "../components/problem-statements-dialog";
import { SubmissionFormDialog, type SubmissionFormValues } from "../components/submission-form-dialog";
import { useCreateSubmission, useDeleteSubmission, useProblemStatements, useSubmissions, useUpdateSubmission } from "../hooks";

function toPayload(values: SubmissionFormValues) {
  return {
    project_title: values.project_title,
    team_identifier: values.team_identifier,
    problem_statement_id: values.problem_statement_id ? Number(values.problem_statement_id) : null,
    short_description: values.short_description || "",
    additional_notes: values.additional_notes || null,
    video_type: values.video_type,
    video_url: values.video_type === "upload" ? null : values.video_url || null,
  };
}

export function SubmissionsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [problemStatementId, setProblemStatementId] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [psOpen, setPsOpen] = useState(false);
  const [editing, setEditing] = useState<SubmissionOut | undefined>();
  const [deleting, setDeleting] = useState<SubmissionOut | null>(null);

  const params = {
    page,
    page_size: 20,
    search: search || undefined,
    problem_statement_id: problemStatementId !== "all" ? Number(problemStatementId) : undefined,
  };
  const { data, isLoading } = useSubmissions(params);
  const { data: problemStatements } = useProblemStatements();

  const createMutation = useCreateSubmission();
  const updateMutation = useUpdateSubmission(editing?.id ?? -1);
  const deleteMutation = useDeleteSubmission();

  const debouncedSearch = useDebouncedCallback((value: string) => {
    setPage(1);
    setSearch(value);
  }, 300);

  const handleSubmit = (values: SubmissionFormValues) => {
    const payload = toPayload(values);
    if (editing) {
      updateMutation.mutate(payload, { onSuccess: () => setFormOpen(false) });
    } else {
      createMutation.mutate(payload, { onSuccess: () => setFormOpen(false) });
    }
  };

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
      header: "Problem statement",
      cell: ({ row }) => row.original.problem_statement?.title ?? <span className="text-muted-foreground">—</span>,
    },
    {
      header: "Assets",
      cell: ({ row }) => (
        <div className="flex items-center gap-3 text-muted-foreground">
          <Presentation className={row.original.has_ppt ? "h-4 w-4 text-primary" : "h-4 w-4 opacity-30"} />
          <FileText className={row.original.has_pdf ? "h-4 w-4 text-primary" : "h-4 w-4 opacity-30"} />
          <Video className={row.original.has_video_file || row.original.video_url ? "h-4 w-4 text-primary" : "h-4 w-4 opacity-30"} />
        </div>
      ),
    },
    {
      header: "Video source",
      cell: ({ row }) => <Badge variant="secondary">{row.original.video_type}</Badge>,
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => navigate(`/admin/submissions/${row.original.id}`)}>View / manage files</DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setEditing(row.original);
                setFormOpen(true);
              }}
            >
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleting(row.original)}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Submissions"
        description="Manage imported hackathon submissions"
        actions={
          <>
            <Button variant="outline" onClick={() => setPsOpen(true)}>
              <ListTree className="h-4 w-4" /> Problem statements
            </Button>
            <Button variant="outline" onClick={() => setBulkOpen(true)}>
              <Upload className="h-4 w-4" /> Bulk import
            </Button>
            <Button
              onClick={() => {
                setEditing(undefined);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> New submission
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by project or team…" className="pl-8" onChange={(e) => debouncedSearch(e.target.value)} />
        </div>
        <Select value={problemStatementId} onValueChange={(v) => { setProblemStatementId(v); setPage(1); }}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="All problem statements" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All problem statements</SelectItem>
            {problemStatements?.map((ps) => (
              <SelectItem key={ps.id} value={String(ps.id)}>
                {ps.code} — {ps.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!isLoading && data?.items.length === 0 ? (
        <EmptyState
          icon={Upload}
          title="No submissions yet"
          description="Create one manually or bulk import from a CSV exported from your event website."
          action={<Button onClick={() => setFormOpen(true)}>New submission</Button>}
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
            <Button variant="outline" size="sm" disabled={page >= data.total_pages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      <SubmissionFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        submission={editing}
        onSubmit={handleSubmit}
        isSaving={createMutation.isPending || updateMutation.isPending}
      />
      <BulkImportDialog open={bulkOpen} onOpenChange={setBulkOpen} />
      <ProblemStatementsDialog open={psOpen} onOpenChange={setPsOpen} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete submission?"
        description={`This will permanently delete "${deleting?.project_title}" and all of its assignments, evaluations, and uploaded files.`}
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
      />
    </div>
  );
}
