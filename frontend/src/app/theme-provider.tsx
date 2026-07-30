import { useEffect } from "react";

import { useUiStore } from "@/store/ui-store";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useUiStore((s) => s.theme);

  useEffect(() => {
    const root = window.document.documentElement;
    const apply = (isDark: boolean) => root.classList.toggle("dark", isDark);

    if (theme === "system") {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      apply(media.matches);
      const listener = (e: MediaQueryListEvent) => apply(e.matches);
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    }

    apply(theme === "dark");
  }, [theme]);

  return <>{children}</>;
}
