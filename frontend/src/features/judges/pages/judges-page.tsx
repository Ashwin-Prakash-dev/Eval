import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, MailPlus, MoreHorizontal, Search, ShieldCheck, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { formatScore, formatSeconds } from "@/lib/utils";
import type { AllowedEmailOut, JudgeStats } from "@/types/judge";

import { ApproveEmailDialog } from "../components/approve-email-dialog";
import { useAllowedEmails, useJudgeStats, useRevokeEmail, useUpdateAllowedEmail } from "../hooks";

interface AccessRow {
  entry: AllowedEmailOut;
  stats: JudgeStats | null;
}

export function JudgesPage() {
  const [search, setSearch] = useState("");
  const [approveOpen, setApproveOpen] = useState(false);
  const [revoking, setRevoking] = useState<AllowedEmailOut | null>(null);

  const { data: allowed, isLoading } = useAllowedEmails(search || undefined);
  const { data: stats } = useJudgeStats();

  const updateAllowed = useUpdateAllowedEmail();
  const revoke = useRevokeEmail();

  const rows = useMemo<AccessRow[]>(() => {
    if (!allowed) return [];
    const statsByUserId = new Map((stats ?? []).map((s) => [s.judge.id, s]));
    return allowed.map((entry) => ({
      entry,
      stats: entry.user ? statsByUserId.get(entry.user.id) ?? null : null,
    }));
  }, [allowed, stats]);

  const debouncedSearch = useDebouncedCallback((value: string) => setSearch(value), 300);

  const columns: ColumnDef<AccessRow>[] = [
    {
      header: "Person",
      cell: ({ row }) => {
        const { entry } = row.original;
        return (
          <div>
            <p className="font-medium">{entry.full_name || entry.user?.full_name || entry.email}</p>
            <p className="text-xs text-muted-foreground">{entry.email}</p>
          </div>
        );
      },
    },
    {
      header: "Role",
      cell: ({ row }) => (
        <Badge variant={row.original.entry.role === "admin" ? "default" : "secondary"}>{row.original.entry.role}</Badge>
      ),
    },
    {
      header: "Status",
      cell: ({ row }) => {
        const { entry } = row.original;
        if (!entry.is_active) return <Badge variant="destructive">Suspended</Badge>;
        if (!entry.user) return <Badge variant="outline">Invited — not signed in</Badge>;
        return <Badge variant="success">Active</Badge>;
      },
    },
    {
      header: "Progress",
      cell: ({ row }) => {
        const s = row.original.stats;
        if (!s || s.reviews_assigned === 0) return <span className="text-muted-foreground">—</span>;
        const pct = Math.round((s.reviews_completed / s.reviews_assigned) * 100);
        return (
          <div className="w-32">
            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>
                {s.reviews_completed}/{s.reviews_assigned}
              </span>
              <span>{pct}%</span>
            </div>
            <Progress value={pct} />
          </div>
        );
      },
    },
    {
      header: "Avg score",
      cell: ({ row }) => formatScore(row.original.stats?.average_score_given ?? null),
    },
    {
      header: "Std dev",
      cell: ({ row }) => formatScore(row.original.stats?.std_dev_given ?? null),
    },
    {
      header: "Avg time",
      cell: ({ row }) => formatSeconds(row.original.stats?.average_review_time_seconds ?? null),
    },
    {
      header: "Flags",
      cell: ({ row }) => {
        const s = row.original.stats;
        if (!s) return null;
        return (
          <div className="flex flex-wrap gap-1">
            {s.is_harsh && (
              <Badge variant="destructive" className="gap-1">
                <TrendingDown className="h-3 w-3" /> Harsh
              </Badge>
            )}
            {s.is_lenient && (
              <Badge variant="warning" className="gap-1">
                <TrendingUp className="h-3 w-3" /> Lenient
              </Badge>
            )}
            {s.is_high_variance && (
              <Badge variant="outline" className="gap-1">
                <AlertTriangle className="h-3 w-3" /> High variance
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const { entry } = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => updateAllowed.mutate({ id: entry.id, payload: { is_active: !entry.is_active } })}
              >
                {entry.is_active ? "Suspend access" : "Restore access"}
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setRevoking(entry)}>
                Revoke access
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Judges & access"
        description="Only approved email addresses can sign in. Accounts are created on first passcode sign-in."
        actions={
          <Button onClick={() => setApproveOpen(true)}>
            <MailPlus className="h-4 w-4" /> Approve email
          </Button>
        }
      />

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by email or name…" className="pl-8" onChange={(e) => debouncedSearch(e.target.value)} />
      </div>

      {!isLoading && rows.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No approved emails yet"
          description="Approve the email addresses of your judges so they can sign in with a one-time passcode."
          action={<Button onClick={() => setApproveOpen(true)}>Approve email</Button>}
        />
      ) : (
        <DataTable columns={columns} data={rows} isLoading={isLoading} />
      )}

      <ApproveEmailDialog open={approveOpen} onOpenChange={setApproveOpen} />

      <ConfirmDialog
        open={!!revoking}
        onOpenChange={(open) => !open && setRevoking(null)}
        title="Revoke access?"
        description={`${revoking?.email} will no longer be able to sign in, and any active session is immediately invalidated. Evaluations they already submitted are kept.`}
        confirmLabel="Revoke access"
        isLoading={revoke.isPending}
        onConfirm={() => revoking && revoke.mutate(revoking.id, { onSuccess: () => setRevoking(null) })}
      />
    </div>
  );
}
