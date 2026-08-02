import { CheckCircle2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { RubricOut } from "@/types/rubric";

import { RubricForm, type RubricFormValues } from "../components/rubric-form";
import { useActivateRubric, useCreateRubric, useDeleteRubric, useRubrics, useUpdateRubric } from "../hooks";

export function RubricPage() {
  const { data: rubrics, isLoading } = useRubrics();
  const createMutation = useCreateRubric();
  const updateMutation = useUpdateRubric();
  const activateMutation = useActivateRubric();
  const deleteMutation = useDeleteRubric();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RubricOut | undefined>();
  const [deleting, setDeleting] = useState<RubricOut | null>(null);

  const handleSubmit = (values: RubricFormValues) => {
    const payload = {
      ...values,
      criteria: values.criteria.map((c, index) => ({ ...c, description: c.description ?? "", order_index: index })),
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, payload }, { onSuccess: () => setFormOpen(false) });
    } else {
      createMutation.mutate(payload, { onSuccess: () => setFormOpen(false) });
    }
  };

  return (
    <div>
      <PageHeader
        title="Evaluation rubric"
        description=""
        actions={
          <Button
            onClick={() => {
              setEditing(undefined);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> New rubric
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      ) : rubrics?.length === 0 ? (
        <EmptyState
          icon={Plus}
          title="No rubric configured yet"
          description="Create a rubric so judges can start scoring submissions."
          action={<Button onClick={() => setFormOpen(true)}>New rubric</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {rubrics?.map((rubric) => (
            <Card key={rubric.id}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2">
                  {rubric.name}
                  {rubric.is_active && (
                    <Badge variant="success" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Active
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-1.5 text-sm">
                  {rubric.criteria.map((c) => (
                    <li key={c.id} className="flex justify-between">
                      <span>{c.name}</span>
                      <span className="tabular-nums text-muted-foreground">{c.weight}%</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">Disagreement threshold: std dev &gt; {rubric.disagreement_threshold}</p>
                <div className="flex gap-2 pt-2">
                  {!rubric.is_active && (
                    <Button size="sm" variant="outline" onClick={() => activateMutation.mutate(rubric.id)}>
                      Activate
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditing(rubric);
                      setFormOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleting(rubric)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit rubric" : "New rubric"}</DialogTitle>
          </DialogHeader>
          <RubricForm
            rubric={editing}
            onSubmit={handleSubmit}
            isSaving={createMutation.isPending || updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete rubric?"
        description={`"${deleting?.name}" will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
      />
    </div>
  );
}
