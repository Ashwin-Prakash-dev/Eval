import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useJudges } from "@/features/judges/hooks";
import { useSubmissions } from "@/features/submissions/hooks";

import { useConflicts, useCreateConflict, useDeleteConflict } from "../hooks";

export function ConflictsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [submissionId, setSubmissionId] = useState<string>();
  const [judgeId, setJudgeId] = useState<string>();
  const [reason, setReason] = useState("");

  const { data: conflicts } = useConflicts();
  const { data: submissions } = useSubmissions({ page: 1, page_size: 500 });
  const { data: judges } = useJudges();
  const createMutation = useCreateConflict();
  const deleteMutation = useDeleteConflict();

  const submissionTitle = (id: number) => submissions?.items.find((s) => s.id === id)?.project_title ?? `#${id}`;
  const judgeName = (id: number) => {
    const judge = judges?.find((j) => j.id === id);
    return judge?.full_name || judge?.username || `#${id}`;
  };

  const handleAdd = () => {
    if (!submissionId || !judgeId) return;
    createMutation.mutate(
      { submission_id: Number(submissionId), judge_id: Number(judgeId), reason: reason || undefined },
      { onSuccess: () => { setSubmissionId(undefined); setJudgeId(undefined); setReason(""); } }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Conflict exclusions</DialogTitle>
          <DialogDescription>Judge/submission pairs listed here are skipped by the assignment generator.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Select value={submissionId} onValueChange={setSubmissionId}>
              <SelectTrigger>
                <SelectValue placeholder="Submission" />
              </SelectTrigger>
              <SelectContent>
                {submissions?.items.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.project_title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={judgeId} onValueChange={setJudgeId}>
              <SelectTrigger>
                <SelectValue placeholder="Judge" />
              </SelectTrigger>
              <SelectContent>
                {judges?.map((j) => (
                  <SelectItem key={j.id} value={String(j.id)}>
                    {j.full_name || j.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Input placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
            <Button onClick={handleAdd} disabled={!submissionId || !judgeId || createMutation.isPending}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="max-h-64 space-y-2 overflow-y-auto scrollbar-thin">
          {conflicts?.length === 0 && <p className="text-sm text-muted-foreground">No conflict exclusions yet.</p>}
          {conflicts?.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-md border p-2.5 text-sm">
              <div>
                <p>
                  {submissionTitle(c.submission_id)} <span className="text-muted-foreground">×</span> {judgeName(c.judge_id)}
                </p>
                {c.reason && <p className="text-xs text-muted-foreground">{c.reason}</p>}
              </div>
              <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(c.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
