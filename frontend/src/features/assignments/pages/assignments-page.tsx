import type { ColumnDef } from "@tanstack/react-table";
import { ShieldAlert, Trash2, UserPlus, Wand2 } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EVALUATION_STATUS_BADGE } from "@/lib/evaluation-status";
import type { AssignmentOut } from "@/types/assignment";
import type { EvaluationStatus } from "@/types/common";

import { ConflictsDialog } from "../components/conflicts-dialog";
import { GenerateAssignmentsDialog } from "../components/generate-assignments-dialog";
import { ManualAssignmentDialog } from "../components/manual-assignment-dialog";
import { useAssignments, useDeleteAssignment } from "../hooks";

export function AssignmentsPage() {
  const { data: assignments, isLoading } = useAssignments();
  const deleteMutation = useDeleteAssignment();

  const [generateOpen, setGenerateOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [conflictsOpen, setConflictsOpen] = useState(false);
  const [removing, setRemoving] = useState<AssignmentOut | null>(null);

  const columns: ColumnDef<AssignmentOut>[] = [
    {
      header: "Submission",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.submission.project_title}</p>
          <p className="text-xs text-muted-foreground">{row.original.submission.team_identifier}</p>
        </div>
      ),
    },
    {
      header: "Judge",
      cell: ({ row }) => row.original.judge.full_name || row.original.judge.email,
    },
    {
      header: "Source",
      cell: ({ row }) => <Badge variant="secondary">{row.original.source}</Badge>,
    },
    {
      header: "Evaluation status",
      cell: ({ row }) => (
        <Badge
          variant={
            EVALUATION_STATUS_BADGE[row.original.evaluation_status as EvaluationStatus]?.variant ?? "outline"
          }
        >
          {row.original.evaluation_status.replace("_", " ")}
        </Badge>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <Button variant="ghost" size="icon" onClick={() => setRemoving(row.original)}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Assignments"
        description="Distribute submissions across judges and manage conflicts of interest"
        actions={
          <>
            <Button variant="outline" onClick={() => setConflictsOpen(true)}>
              <ShieldAlert className="h-4 w-4" /> Conflicts
            </Button>
            <Button variant="outline" onClick={() => setManualOpen(true)}>
              <UserPlus className="h-4 w-4" /> Manual assign
            </Button>
            <Button onClick={() => setGenerateOpen(true)}>
              <Wand2 className="h-4 w-4" /> Generate assignments
            </Button>
          </>
        }
      />

      {!isLoading && assignments?.length === 0 ? (
        <EmptyState
          icon={Wand2}
          title="No assignments yet"
          description="Generate assignments automatically, or assign judges to submissions manually."
          action={<Button onClick={() => setGenerateOpen(true)}>Generate assignments</Button>}
        />
      ) : (
        <DataTable columns={columns} data={assignments ?? []} isLoading={isLoading} />
      )}

      <GenerateAssignmentsDialog open={generateOpen} onOpenChange={setGenerateOpen} />
      <ManualAssignmentDialog open={manualOpen} onOpenChange={setManualOpen} />
      <ConflictsDialog open={conflictsOpen} onOpenChange={setConflictsOpen} />

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Remove assignment?"
        description={`${removing?.judge.full_name || removing?.judge.email} will no longer review "${removing?.submission.project_title}". Any progress they made will be deleted.`}
        confirmLabel="Remove"
        isLoading={deleteMutation.isPending}
        onConfirm={() => removing && deleteMutation.mutate(removing.id, { onSuccess: () => setRemoving(null) })}
      />
    </div>
  );
}
