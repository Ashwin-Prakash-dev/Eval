import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, KeyRound, MoreHorizontal, Plus, Search, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/shared/data-table";
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
import { formatScore, formatSeconds } from "@/lib/utils";
import type { JudgeStats } from "@/types/judge";

import { JudgeFormDialog } from "../components/judge-form-dialog";
import { ResetPasswordDialog } from "../components/reset-password-dialog";
import { useCreateJudge, useJudgeStats, useJudges, useResetJudgePassword, useToggleJudgeActive, useUpdateJudge } from "../hooks";

export function JudgesPage() {
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<JudgeStats["judge"] | null>(null);
  const [editing, setEditing] = useState<JudgeStats["judge"] | undefined>();

  const { data: judges, isLoading: judgesLoading } = useJudges(search || undefined);
  const { data: stats, isLoading: statsLoading } = useJudgeStats();

  const createMutation = useCreateJudge();
  const updateMutation = useUpdateJudge();
  const toggleActive = useToggleJudgeActive();
  const resetPassword = useResetJudgePassword();

  const rows = useMemo<JudgeStats[]>(() => {
    if (!judges) return [];
    const statsById = new Map(stats?.map((s) => [s.judge.id, s]));
    return judges.map(
      (judge) =>
        statsById.get(judge.id) ?? {
          judge,
          reviews_assigned: 0,
          reviews_completed: 0,
          reviews_pending: 0,
          average_score_given: null,
          std_dev_given: null,
          average_review_time_seconds: null,
          is_harsh: false,
          is_lenient: false,
          is_high_variance: false,
        }
    );
  }, [judges, stats]);

  const columns: ColumnDef<JudgeStats>[] = [
    {
      header: "Judge",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.judge.full_name || row.original.judge.username}</p>
          <p className="text-xs text-muted-foreground">@{row.original.judge.username}</p>
        </div>
      ),
    },
    {
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.judge.is_active ? "success" : "secondary"}>
          {row.original.judge.is_active ? "Active" : "Deactivated"}
        </Badge>
      ),
    },
    {
      header: "Progress",
      cell: ({ row }) => {
        const pct = row.original.reviews_assigned
          ? Math.round((row.original.reviews_completed / row.original.reviews_assigned) * 100)
          : 0;
        return (
          <div className="w-32">
            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>{row.original.reviews_completed}/{row.original.reviews_assigned}</span>
              <span>{pct}%</span>
            </div>
            <Progress value={pct} />
          </div>
        );
      },
    },
    {
      header: "Avg score given",
      cell: ({ row }) => formatScore(row.original.average_score_given),
    },
    {
      header: "Std dev",
      cell: ({ row }) => formatScore(row.original.std_dev_given),
    },
    {
      header: "Avg review time",
      cell: ({ row }) => formatSeconds(row.original.average_review_time_seconds),
    },
    {
      header: "Flags",
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.is_harsh && (
            <Badge variant="destructive" className="gap-1">
              <TrendingDown className="h-3 w-3" /> Harsh
            </Badge>
          )}
          {row.original.is_lenient && (
            <Badge variant="warning" className="gap-1">
              <TrendingUp className="h-3 w-3" /> Lenient
            </Badge>
          )}
          {row.original.is_high_variance && (
            <Badge variant="outline" className="gap-1">
              <AlertTriangle className="h-3 w-3" /> High variance
            </Badge>
          )}
        </div>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                setEditing(row.original.judge);
                setFormOpen(true);
              }}
            >
              Edit name
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setResetTarget(row.original.judge)}>
              <KeyRound className="mr-2 h-4 w-4" /> Reset password
            </DropdownMenuItem>
            <DropdownMenuItem
              className={row.original.judge.is_active ? "text-destructive focus:text-destructive" : ""}
              onClick={() =>
                toggleActive.mutate({ id: row.original.judge.id, activate: !row.original.judge.is_active })
              }
            >
              {row.original.judge.is_active ? "Deactivate" : "Reactivate"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Judges"
        description="Manage judge accounts and review their scoring behavior"
        actions={
          <Button
            onClick={() => {
              setEditing(undefined);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> New judge
          </Button>
        }
      />

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search judges…" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <DataTable columns={columns} data={rows} isLoading={judgesLoading || statsLoading} emptyMessage="No judges yet." />

      <JudgeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        judge={editing}
        isSaving={createMutation.isPending || updateMutation.isPending}
        onCreate={(values) => createMutation.mutate(values, { onSuccess: () => setFormOpen(false) })}
        onEdit={(values) =>
          editing && updateMutation.mutate({ id: editing.id, payload: values }, { onSuccess: () => setFormOpen(false) })
        }
      />

      {resetTarget && (
        <ResetPasswordDialog
          open={!!resetTarget}
          onOpenChange={(open) => !open && setResetTarget(null)}
          judgeName={resetTarget.full_name || resetTarget.username}
          isSaving={resetPassword.isPending}
          onSubmit={(password) =>
            resetPassword.mutate({ id: resetTarget.id, new_password: password }, { onSuccess: () => setResetTarget(null) })
          }
        />
      )}
    </div>
  );
}
