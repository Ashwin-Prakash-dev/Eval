import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { App } from "./app/App";
import { queryClient } from "./app/query-client";
import { ThemeProvider } from "./app/theme-provider";
import { Toaster } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import "./styles/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider delayDuration={200}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
          <Toaster position="top-right" richColors closeButton />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>
);
