import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  isLoading?: boolean;
  hint?: string;
  tone?: "default" | "success" | "warning" | "destructive";
}

const toneStyles = {
  default: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
};

export function StatCard({ label, value, icon: Icon, isLoading, hint, tone = "default" }: StatCardProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <Card>
        <CardContent className="flex items-start justify-between p-5">
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            {isLoading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <p className="text-2xl font-semibold tabular-nums">{value}</p>
            )}
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
          </div>
          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", toneStyles[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
