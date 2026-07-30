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

const schema = z.object({ new_password: z.string().min(6, "At least 6 characters").max(128) });
type FormValues = z.infer<typeof schema>;

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  judgeName: string;
  onSubmit: (password: string) => void;
  isSaving?: boolean;
}

export function ResetPasswordDialog({ open, onOpenChange, judgeName, onSubmit, isSaving }: ResetPasswordDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) reset(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>Set a new password for {judgeName}. Share it with them securely.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((v) => onSubmit(v.new_password))} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new_password">New password</Label>
            <Input id="new_password" type="password" autoFocus {...register("new_password")} />
            {errors.new_password && <p className="text-xs text-destructive">{errors.new_password.message}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving…" : "Reset password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
