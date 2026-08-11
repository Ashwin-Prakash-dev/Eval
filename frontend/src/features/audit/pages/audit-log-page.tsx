import type { ColumnDef } from "@tanstack/react-table";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";

import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AuditLogOut } from "@/types/audit";

import { useAuditLogs } from "../hooks";

const entityTypes = [
  "submission",
  "judge",
  "user",
];

const actionTone: Record<string, "destructive" | "success" | "secondary"> = {
  delete: "destructive",
  deactivate: "destructive",
  create: "success",
  activate: "success",
  register: "success",
};

export function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState<string>("all");
  const { data, isLoading } = useAuditLogs(page, 50, entityType !== "all" ? entityType : undefined);

  const columns: ColumnDef<AuditLogOut>[] = [
    {
      header: "When",
      cell: ({ row }) => (
        <span title={new Date(row.original.created_at).toLocaleString()}>
          {formatDistanceToNow(new Date(row.original.created_at), { addSuffix: true })}
        </span>
      ),
    },
    {
      header: "User",
      cell: ({ row }) => row.original.email ?? <span className="text-muted-foreground">system</span>,
    },
    {
      header: "Action",
      cell: ({ row }) => <Badge variant={actionTone[row.original.action] ?? "secondary"}>{row.original.action}</Badge>,
    },
    {
      header: "Entity",
      cell: ({ row }) => (
        <span>
          {row.original.entity_type}
          {row.original.entity_id ? ` #${row.original.entity_id}` : ""}
        </span>
      ),
    },
    {
      header: "Details",
      cell: ({ row }) => (
        <code className="text-xs text-muted-foreground">{JSON.stringify(row.original.details).slice(0, 120)}</code>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Audit history" description="Every administrative action taken in this workspace" />

      <div className="mb-4">
        <Select value={entityType} onValueChange={(v) => { setEntityType(v); setPage(1); }}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All entity types</SelectItem>
            {entityTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type.replace("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable columns={columns} data={data?.items ?? []} isLoading={isLoading} emptyMessage="No activity recorded yet." />

      {data && data.total_pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {data.page} of {data.total_pages} — {data.total} entries
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= data.total_pages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
