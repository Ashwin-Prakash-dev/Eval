import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { useCreateProblemStatement, useDeleteProblemStatement, useProblemStatements } from "../hooks";

const schema = z.object({
  code: z.string().min(1, "Required").max(32),
  title: z.string().min(1, "Required").max(255),
  description: z.string().max(2000).optional(),
});
type FormValues = z.infer<typeof schema>;

export function ProblemStatementsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: problemStatements, isLoading } = useProblemStatements();
  const createMutation = useCreateProblemStatement();
  const deleteMutation = useDeleteProblemStatement();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Problem statements</DialogTitle>
          <DialogDescription>Track categories from your event website so submissions can be grouped.</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit((values) => createMutation.mutate(values, { onSuccess: () => reset() }))}
          className="grid grid-cols-[1fr_2fr_auto] gap-2"
        >
          <div>
            <Input placeholder="Code (PS1)" {...register("code")} />
            {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
          </div>
          <div>
            <Input placeholder="Title" {...register("title")} />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>
          <Button type="submit" size="icon" disabled={createMutation.isPending}>
            <Plus className="h-4 w-4" />
          </Button>
          <div className="col-span-3">
            <Label className="sr-only">Description</Label>
            <Textarea rows={2} placeholder="Description (optional)" {...register("description")} />
          </div>
        </form>

        <div className="max-h-72 space-y-2 overflow-y-auto scrollbar-thin">
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {problemStatements?.map((ps) => (
            <div key={ps.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
              <div>
                <p className="font-medium">
                  {ps.code} — {ps.title}
                </p>
                {ps.description && <p className="text-xs text-muted-foreground">{ps.description}</p>}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteMutation.mutate(ps.id)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          {problemStatements?.length === 0 && !isLoading && (
            <p className="text-sm text-muted-foreground">No problem statements yet.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
