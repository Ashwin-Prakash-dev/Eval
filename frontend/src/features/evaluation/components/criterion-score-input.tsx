import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { CriterionBrief } from "@/types/evaluation";

interface CriterionScoreInputProps {
  criterion: CriterionBrief;
  score: number | null;
  comment: string;
  onScoreChange: (score: number) => void;
  onCommentChange: (comment: string) => void;
}

export function CriterionScoreInput({
  criterion,
  score,
  comment,
  onScoreChange,
  onCommentChange,
}: CriterionScoreInputProps) {
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Label className="text-sm font-semibold">{criterion.name}</Label>
          <p className="text-xs text-muted-foreground">{criterion.description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className={cn("text-xl font-bold tabular-nums", score === null && "text-muted-foreground")}>
            {score ?? "–"}
          </span>
          <span className="text-xs text-muted-foreground">/10</span>
        </div>
      </div>

      <Slider
        min={1}
        max={10}
        step={0.5}
        value={[score ?? 5]}
        onValueChange={([value]) => onScoreChange(value)}
        aria-label={`${criterion.name} score`}
      />

      <Textarea
        placeholder="Comment (optional)"
        rows={2}
        value={comment}
        onChange={(e) => onCommentChange(e.target.value)}
        className="text-sm"
      />
    </div>
  );
}
