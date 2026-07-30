import { Download, FileWarning } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProtectedFile } from "@/hooks/use-protected-file";
import { getEmbedUrl } from "@/lib/video-embed";
import type { VideoType } from "@/types/common";

export function PdfViewer({ path, hasFile }: { path: string; hasFile: boolean }) {
  const { url, isLoading, error } = useProtectedFile(hasFile ? path : null);

  if (!hasFile) return <NoAsset label="No PDF uploaded" />;
  if (isLoading) return <Skeleton className="h-full min-h-[420px] w-full" />;
  if (error || !url) return <NoAsset label="Could not load PDF" />;

  return <iframe title="PDF preview" src={url} className="h-full min-h-[420px] w-full rounded-lg border bg-white" />;
}

export function PptAsset({ path, hasFile }: { path: string; hasFile: boolean }) {
  const { url, isLoading, error } = useProtectedFile(hasFile ? path : null);

  if (!hasFile) return <NoAsset label="No slide deck uploaded" />;
  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (error || !url) return <NoAsset label="Could not load slide deck" />;

  return (
    <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-4">
      <div>
        <p className="text-sm font-medium">Slide deck (PPT)</p>
        <p className="text-xs text-muted-foreground">In-browser preview isn't available for PowerPoint files — download to view.</p>
      </div>
      <Button asChild size="sm" variant="outline">
        <a href={url} download>
          <Download className="h-4 w-4" /> Download
        </a>
      </Button>
    </div>
  );
}

export function VideoPlayer({
  videoType,
  videoUrl,
  filePath,
  hasFile,
}: {
  videoType: VideoType;
  videoUrl: string | null;
  filePath: string;
  hasFile: boolean;
}) {
  const { url, isLoading, error } = useProtectedFile(videoType === "upload" && hasFile ? filePath : null);

  if (videoType === "upload") {
    if (!hasFile) return <NoAsset label="No video uploaded" />;
    if (isLoading) return <Skeleton className="aspect-video w-full" />;
    if (error || !url) return <NoAsset label="Could not load video" />;
    return <video controls src={url} className="aspect-video w-full rounded-lg border bg-black" />;
  }

  const embed = videoUrl ? getEmbedUrl(videoUrl, videoType) : null;
  if (!embed) return <NoAsset label="No pitch video linked" />;

  return (
    <iframe
      title="Pitch video"
      src={embed}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      className="aspect-video w-full rounded-lg border bg-black"
    />
  );
}

function NoAsset({ label }: { label: string }) {
  return (
    <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-muted-foreground">
      <FileWarning className="h-6 w-6" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
