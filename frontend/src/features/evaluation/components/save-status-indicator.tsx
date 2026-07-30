import { AlertCircle, Check, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { SaveStatus } from "../use-evaluation-autosave";

export function SaveStatusIndicator({ status, onRetry }: { status: SaveStatus; onRetry: () => void }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={status}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 4 }}
        transition={{ duration: 0.15 }}
        className={cn(
          "flex items-center gap-1.5 text-xs font-medium",
          status === "saved" && "text-success",
          status === "saving" && "text-muted-foreground",
          status === "error" && "text-destructive",
          status === "idle" && "text-muted-foreground"
        )}
      >
        {status === "saving" && (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
          </>
        )}
        {status === "saved" && (
          <>
            <Check className="h-3.5 w-3.5" /> Saved
          </>
        )}
        {status === "error" && (
          <>
            <AlertCircle className="h-3.5 w-3.5" /> Failed to save
            <Button size="sm" variant="ghost" className="h-6 px-2 text-destructive" onClick={onRetry}>
              Retry
            </Button>
          </>
        )}
        {status === "idle" && <span>Autosave ready</span>}
      </motion.div>
    </AnimatePresence>
  );
}
