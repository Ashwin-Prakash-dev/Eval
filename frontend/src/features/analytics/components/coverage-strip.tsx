import { Link } from "react-router-dom";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CoverageOut } from "@/types/analytics";

/**
 * Review coverage at a glance.
 *
 * Judges pick their own work now, so nothing guarantees that every submission gets reviewed.
 * This answers the question allocation used to answer for free: is the field going to be
 * scored, and what is still short. The unreviewed count is the one that needs chasing, so it
 * is the only figure allowed to go red.
 */
export function CoverageStrip({ coverage }: { coverage: CoverageOut }) {
  const max = Math.max(...coverage.buckets.map((b) => b.count), 1);

  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="font-medium">Review coverage</p>
            <p className="text-xs text-muted-foreground">
              A submission is scored once {coverage.scoring_limit} judges have completed it
            </p>
          </div>
          <p className="text-sm tabular-nums text-muted-foreground">
            <span className="text-base font-semibold text-foreground">{coverage.fully_scored}</span>
            {" of "}
            {coverage.total_submissions} scored
          </p>
        </div>

        <div className="space-y-2">
          {coverage.buckets.map((bucket, index) => {
            const isUnreviewed = index === 0;
            const isScored = index === coverage.buckets.length - 1;
            return (
              <div key={bucket.label} className="flex items-center gap-3 text-sm">
                <span className="w-28 shrink-0 text-xs text-muted-foreground">{bucket.label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      isUnreviewed && bucket.count > 0
                        ? "bg-destructive"
                        : isScored
                          ? "bg-emerald-500"
                          : "bg-primary"
                    )}
                    style={{ width: `${(bucket.count / max) * 100}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right tabular-nums">{bucket.count}</span>
              </div>
            );
          })}
        </div>

        {coverage.unreviewed > 0 && (
          <Link
            to="/admin/coverage"
            className="mt-4 inline-block text-sm font-medium text-destructive hover:underline"
          >
            {coverage.unreviewed} submission{coverage.unreviewed === 1 ? " has" : "s have"} no
            reviews yet →
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
