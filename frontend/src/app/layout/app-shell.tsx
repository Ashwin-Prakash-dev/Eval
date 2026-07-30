import { Outlet } from "react-router-dom";

import { ErrorBoundary } from "@/components/shared/error-boundary";

import type { NavItem } from "./sidebar";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell({ navItems, brand, pageTitle }: { navItems: NavItem[]; brand: string; pageTitle: string }) {
  return (
    <div className="flex min-h-screen bg-muted/20">
      <Sidebar items={navItems} title={brand} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar title={pageTitle} />
        <main className="flex-1 p-4 sm:p-6">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
