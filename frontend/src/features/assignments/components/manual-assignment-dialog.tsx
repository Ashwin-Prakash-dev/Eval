import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useJudges } from "@/features/judges/hooks";
import { useSubmissions } from "@/features/submissions/hooks";

import { useCreateManualAssignment } from "../hooks";

export function ManualAssignmentDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [submissionId, setSubmissionId] = useState<string>();
  const [judgeId, setJudgeId] = useState<string>();
  const { data: submissions } = useSubmissions({ page: 1, page_size: 500 });
  const { data: judges } = useJudges();
  const createMutation = useCreateManualAssignment();

  const handleSubmit = () => {
    if (!submissionId || !judgeId) return;
    createMutation.mutate(
      { submission_id: Number(submissionId), judge_id: Number(judgeId) },
      {
        onSuccess: () => {
          onOpenChange(false);
          setSubmissionId(undefined);
          setJudgeId(undefined);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manually assign a judge</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Submission</Label>
            <Select value={submissionId} onValueChange={setSubmissionId}>
              <SelectTrigger>
                <SelectValue placeholder="Select submission" />
              </SelectTrigger>
              <SelectContent>
                {submissions?.items.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.project_title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Judge</Label>
            <Select value={judgeId} onValueChange={setJudgeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select judge" />
              </SelectTrigger>
              <SelectContent>
                {judges?.filter((j) => j.is_active).map((j) => (
                  <SelectItem key={j.id} value={String(j.id)}>
                    {j.full_name || j.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!submissionId || !judgeId || createMutation.isPending}>
            {createMutation.isPending ? "Assigning…" : "Assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
