import { useEffect, useState } from "react";

import { useUiStore } from "@/store/ui-store";

function computeIsDark(theme: "light" | "dark" | "system"): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function useIsDark(): boolean {
  const theme = useUiStore((s) => s.theme);
  const [isDark, setIsDark] = useState(() => computeIsDark(theme));

  useEffect(() => {
    setIsDark(computeIsDark(theme));
    if (theme !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => setIsDark(computeIsDark(theme));
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [theme]);

  return isDark;
}
