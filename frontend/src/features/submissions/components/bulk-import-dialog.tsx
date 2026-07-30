import { UploadCloud } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { BulkImportResult } from "@/types/submission";

import { useBulkImportSubmissions } from "../hooks";

export function BulkImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<BulkImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bulkImport = useBulkImportSubmissions();

  const handleImport = () => {
    if (!file) return;
    bulkImport.mutate(file, { onSuccess: (data) => setResult(data) });
  };

  const handleClose = (next: boolean) => {
    if (!next) {
      setFile(null);
      setResult(null);
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bulk import submissions</DialogTitle>
          <DialogDescription>
            Upload a CSV with columns: project_title, team_identifier, problem_statement_code, short_description,
            additional_notes, video_type, video_url.
          </DialogDescription>
        </DialogHeader>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors hover:bg-accent"
        >
          <UploadCloud className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">{file ? file.name : "Click to choose a CSV file"}</p>
          <p className="text-xs text-muted-foreground">.csv up to a few thousand rows</p>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />

        {result && (
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <p>
              Imported <strong>{result.created}</strong>, failed <strong>{result.failed}</strong>
            </p>
            {result.errors.length > 0 && (
              <ul className="mt-2 max-h-32 list-disc space-y-0.5 overflow-y-auto pl-4 text-xs text-destructive scrollbar-thin">
                {result.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Close
          </Button>
          <Button onClick={handleImport} disabled={!file || bulkImport.isPending}>
            {bulkImport.isPending ? "Importing…" : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
