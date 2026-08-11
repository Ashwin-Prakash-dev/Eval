import { ExternalLink, FileWarning } from "lucide-react";

import { getEmbedUrl } from "@/lib/video-embed";

/**
 * The deck and the pitch video are URLs owned by the startathon system (a Google Drive link
 * and a YouTube link), not files this app stores. Both are verified as publicly viewable on
 * that side before a team can submit, so they are rendered directly rather than proxied.
 */

export function VideoEmbed({ url }: { url: string }) {
  // Every startathon submission links YouTube; anything else falls back to a plain link
  // rather than an iframe that would silently render blank.
  const embed = url ? getEmbedUrl(url, "youtube") : null;

  if (!embed) {
    return url ? (
      <ExternalAsset url={url} label="Open pitch video" />
    ) : (
      <NoAsset label="No pitch video linked" />
    );
  }

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

/**
 * Drive refuses to render inside an iframe for most sharing configurations, so the deck is
 * an explicit link out rather than a preview that would frequently show an error page.
 *
 * `compact` renders a single row instead of a drop-zone-sized block, for the narrow side
 * rail where the deck sits beside the application text rather than being the main content.
 */
export function DeckLink({ url, compact = false }: { url: string; compact?: boolean }) {
  if (!url) {
    return compact ? (
      <p className="text-sm text-muted-foreground">No deck linked</p>
    ) : (
      <NoAsset label="No deck linked" />
    );
  }
  if (compact) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
      >
        <ExternalLink className="h-4 w-4 shrink-0" />
        Open slide deck
      </a>
    );
  }
  return <ExternalAsset url={url} label="Open slide deck" />;
}

function ExternalAsset({ url, label }: { url: string; label: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
    >
      <ExternalLink className="h-6 w-6" />
      <p className="text-sm font-medium">{label}</p>
      <p className="max-w-full truncate px-4 text-xs">{url}</p>
    </a>
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
