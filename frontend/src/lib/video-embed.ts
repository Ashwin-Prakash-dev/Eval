export function getEmbedUrl(url: string, type: "youtube" | "vimeo"): string | null {
  try {
    if (type === "youtube") {
      const parsed = new URL(url);
      let videoId = parsed.searchParams.get("v");
      if (!videoId && parsed.hostname.includes("youtu.be")) {
        videoId = parsed.pathname.slice(1);
      }
      if (!videoId && parsed.pathname.includes("/embed/")) {
        return url;
      }
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }

    if (type === "vimeo") {
      const parsed = new URL(url);
      if (parsed.pathname.includes("/video/")) return url;
      const match = parsed.pathname.match(/\/(\d+)/);
      return match ? `https://player.vimeo.com/video/${match[1]}` : null;
    }
  } catch {
    return null;
  }
  return null;
}
