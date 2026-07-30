import { useEffect, useState } from "react";

import { apiClient } from "@/lib/api-client";

/** Fetches a file from an authenticated API endpoint and exposes it as a blob object URL,
 * since <video>/<iframe> src attributes can't carry an Authorization header directly. */
export function useProtectedFile(path: string | null): { url: string | null; isLoading: boolean; error: boolean } {
  const [url, setUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;

    setIsLoading(true);
    setError(false);
    apiClient
      .get(path, { responseType: "blob" })
      .then((res) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(res.data);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  return { url, isLoading, error };
}
