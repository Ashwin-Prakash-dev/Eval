import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import { useGenerateAssignments } from "../hooks";

const schema = z.object({
  judges_per_submission: z.coerce.number().int().min(1).max(50),
  reset_existing: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

export function GenerateAssignmentsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const generate = useGenerateAssignments();
  const { register, handleSubmit, watch, setValue } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { judges_per_submission: 3, reset_existing: false },
  });

  const resetExisting = watch("reset_existing");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate assignments</DialogTitle>
          <DialogDescription>
            Every submission gets exactly the judge count you specify below; load is balanced as evenly as possible
            across active judges. Safe to re-run — submissions that already have enough judges are skipped.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((values) =>
            generate.mutate(values, { onSuccess: () => onOpenChange(false) })
          )}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="judges_per_submission">Judges per submission</Label>
            <Input id="judges_per_submission" type="number" min={1} {...register("judges_per_submission")} />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Reset existing assignments</p>
              <p className="text-xs text-muted-foreground">Deletes every current assignment before generating new ones.</p>
            </div>
            <Switch checked={resetExisting} onCheckedChange={(v) => setValue("reset_existing", v)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={generate.isPending}>
              {generate.isPending ? "Generating…" : "Generate"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
