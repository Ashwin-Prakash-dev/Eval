import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { JudgeOut } from "@/types/judge";

const createSchema = z.object({
  full_name: z.string().max(120).optional(),
  username: z
    .string()
    .min(3, "At least 3 characters")
    .max(64)
    .regex(/^[a-zA-Z0-9_.-]+$/, "Letters, numbers, dots, dashes and underscores only"),
  password: z.string().min(6, "At least 6 characters").max(128),
});
const editSchema = z.object({ full_name: z.string().max(120).optional() });

type CreateValues = z.infer<typeof createSchema>;
type EditValues = z.infer<typeof editSchema>;

interface JudgeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  judge?: JudgeOut;
  onCreate: (values: CreateValues) => void;
  onEdit: (values: EditValues) => void;
  isSaving?: boolean;
}

export function JudgeFormDialog({ open, onOpenChange, judge, onCreate, onEdit, isSaving }: JudgeFormDialogProps) {
  const schema = judge ? editSchema : createSchema;
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateValues>({ resolver: zodResolver(schema as typeof createSchema) });

  useEffect(() => {
    if (open) reset(judge ? { full_name: judge.full_name ?? "" } : undefined);
  }, [open, judge, reset]);

  const submit = (values: CreateValues) => (judge ? onEdit(values) : onCreate(values));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{judge ? "Edit judge" : "Create judge"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(submit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="full_name">Full name</Label>
            <Input id="full_name" {...register("full_name")} />
          </div>
          {!judge && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="username">Username</Label>
                <Input id="username" {...register("username")} />
                {errors.username && <p className="text-xs text-destructive">{errors.username.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Temporary password</Label>
                <Input id="password" type="password" {...register("password")} />
                {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
              </div>
            </>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving…" : judge ? "Save changes" : "Create judge"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
