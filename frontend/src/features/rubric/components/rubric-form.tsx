import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { RubricOut } from "@/types/rubric";

const criterionSchema = z.object({
  name: z.string().min(1, "Required").max(120),
  description: z.string().max(500).optional(),
  weight: z.coerce.number().min(0.01, "Must be > 0").max(100),
});

const schema = z.object({
  name: z.string().min(1, "Required").max(120),
  disagreement_threshold: z.coerce.number().min(0.1).max(10),
  criteria: z.array(criterionSchema).min(1, "Add at least one criterion"),
});

export type RubricFormValues = z.infer<typeof schema>;

interface RubricFormProps {
  rubric?: RubricOut;
  onSubmit: (values: RubricFormValues) => void;
  isSaving?: boolean;
  submitLabel?: string;
}

const emptyCriterion = { name: "", description: "", weight: 0 };

export function RubricForm({ rubric, onSubmit, isSaving, submitLabel = "Save rubric" }: RubricFormProps) {
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RubricFormValues>({
    resolver: zodResolver(schema),
    defaultValues: rubric
      ? {
          name: rubric.name,
          disagreement_threshold: rubric.disagreement_threshold,
          criteria: rubric.criteria.map((c) => ({ name: c.name, description: c.description, weight: c.weight })),
        }
      : { name: "", disagreement_threshold: 1.5, criteria: [{ ...emptyCriterion, weight: 100 }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "criteria" });

  const criteria = watch("criteria");
  const totalWeight = criteria.reduce((sum, c) => sum + (Number(c.weight) || 0), 0);
  const isBalanced = Math.abs(totalWeight - 100) < 0.01;

  return (
    <form
      onSubmit={handleSubmit((values) => {
        if (Math.abs(values.criteria.reduce((s, c) => s + Number(c.weight), 0) - 100) > 0.01) return;
        onSubmit(values);
      })}
      className="space-y-5"
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Rubric name</Label>
          <Input id="name" {...register("name")} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="disagreement_threshold">Disagreement threshold (std dev)</Label>
          <Input id="disagreement_threshold" type="number" step="0.1" {...register("disagreement_threshold")} />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Criteria</Label>
          <span className={cn("text-sm font-medium tabular-nums", isBalanced ? "text-success" : "text-destructive")}>
            Total weight: {totalWeight.toFixed(1)}% {isBalanced ? "✓" : "(must equal 100%)"}
          </span>
        </div>

        {fields.map((field, index) => (
          <motion.div
            key={field.id}
            layout
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 rounded-lg border p-3"
          >
            <GripVertical className="mt-2.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="grid flex-1 grid-cols-[2fr_3fr_1fr] gap-3">
              <div>
                <Input placeholder="Criterion name" {...register(`criteria.${index}.name`)} />
                {errors.criteria?.[index]?.name && (
                  <p className="text-xs text-destructive">{errors.criteria[index]?.name?.message}</p>
                )}
              </div>
              <Textarea placeholder="Description" rows={1} {...register(`criteria.${index}.description`)} />
              <Input type="number" step="1" placeholder="Weight %" {...register(`criteria.${index}.weight`)} />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => remove(index)}
              disabled={fields.length === 1}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </motion.div>
        ))}

        <Button type="button" variant="outline" size="sm" onClick={() => append(emptyCriterion)}>
          <Plus className="h-4 w-4" /> Add criterion
        </Button>
        {errors.criteria?.root && <p className="text-xs text-destructive">{errors.criteria.root.message}</p>}
      </div>

      <Button type="submit" disabled={isSaving || !isBalanced}>
        {isSaving ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
