import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { SubmissionOut } from "@/types/submission";

import { useProblemStatements } from "../hooks";

const schema = z.object({
  project_title: z.string().min(1, "Required").max(255),
  team_identifier: z.string().min(1, "Required").max(120),
  problem_statement_id: z.string().optional(),
  short_description: z.string().max(2000).optional(),
  additional_notes: z.string().max(2000).optional(),
  video_type: z.enum(["upload", "youtube", "vimeo"]),
  video_url: z.string().optional(),
});

export type SubmissionFormValues = z.infer<typeof schema>;

interface SubmissionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submission?: SubmissionOut;
  onSubmit: (values: SubmissionFormValues) => void;
  isSaving?: boolean;
}

export function SubmissionFormDialog({ open, onOpenChange, submission, onSubmit, isSaving }: SubmissionFormDialogProps) {
  const { data: problemStatements } = useProblemStatements();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<SubmissionFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { video_type: "youtube" },
  });

  useEffect(() => {
    if (open) {
      reset(
        submission
          ? {
              project_title: submission.project_title,
              team_identifier: submission.team_identifier,
              problem_statement_id: submission.problem_statement ? String(submission.problem_statement.id) : undefined,
              short_description: submission.short_description,
              additional_notes: submission.additional_notes ?? "",
              video_type: submission.video_type,
              video_url: submission.video_url ?? "",
            }
          : { video_type: "youtube" }
      );
    }
  }, [open, submission, reset]);

  const videoType = watch("video_type");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{submission ? "Edit submission" : "Create submission"}</DialogTitle>
          <DialogDescription>
            The team identifier is only ever shown to administrators — judges never see it.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="project_title">Project title</Label>
              <Input id="project_title" {...register("project_title")} />
              {errors.project_title && <p className="text-xs text-destructive">{errors.project_title.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="team_identifier">Team identifier</Label>
              <Input id="team_identifier" {...register("team_identifier")} />
              {errors.team_identifier && <p className="text-xs text-destructive">{errors.team_identifier.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Problem statement</Label>
            <Select
              value={watch("problem_statement_id")}
              onValueChange={(value) => setValue("problem_statement_id", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a problem statement" />
              </SelectTrigger>
              <SelectContent>
                {problemStatements?.map((ps) => (
                  <SelectItem key={ps.id} value={String(ps.id)}>
                    {ps.code} — {ps.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="short_description">Short description</Label>
            <Textarea id="short_description" rows={3} {...register("short_description")} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="additional_notes">Additional notes (optional)</Label>
            <Textarea id="additional_notes" rows={2} {...register("additional_notes")} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Video source</Label>
              <Select value={videoType} onValueChange={(value) => setValue("video_type", value as SubmissionFormValues["video_type"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="youtube">YouTube</SelectItem>
                  <SelectItem value="vimeo">Vimeo</SelectItem>
                  <SelectItem value="upload">Local upload</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {videoType !== "upload" && (
              <div className="space-y-1.5">
                <Label htmlFor="video_url">Video URL</Label>
                <Input id="video_url" placeholder="https://…" {...register("video_url")} />
              </div>
            )}
          </div>
          {videoType === "upload" && (
            <p className="text-xs text-muted-foreground">
              Save the submission first, then upload the video file from its detail page.
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving…" : submission ? "Save changes" : "Create submission"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
