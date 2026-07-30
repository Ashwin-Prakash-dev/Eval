import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { exportApi } from "../api";

export function ExportMenu() {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (format: "csv" | "xlsx" | "pdf") => {
    setIsExporting(true);
    try {
      await exportApi.download(format);
      toast.success(`Report exported as ${format.toUpperCase()}`);
    } catch {
      toast.error("Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={isExporting}>
          <Download className="h-4 w-4" /> {isExporting ? "Exporting…" : "Export"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport("csv")}>Export as CSV</DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("xlsx")}>Export as Excel</DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("pdf")}>Export as PDF</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
