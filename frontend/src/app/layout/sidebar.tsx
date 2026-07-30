import { motion } from "framer-motion";
import { ChevronsLeft, ChevronsRight, LayoutGrid } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavLink } from "react-router-dom";

import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/ui-store";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export function Sidebar({ items, title }: { items: NavItem[]; title: string }) {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 240 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="sticky top-0 hidden h-screen shrink-0 flex-col border-r bg-card md:flex"
    >
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <LayoutGrid className="h-4 w-4" />
        </div>
        {!collapsed && <span className="truncate text-sm font-semibold">{title}</span>}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3 scrollbar-thin">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <button
        onClick={toggleSidebar}
        className="flex h-11 items-center justify-center gap-2 border-t text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        {!collapsed && "Collapse"}
      </button>
    </motion.aside>
  );
}
