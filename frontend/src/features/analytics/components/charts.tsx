import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useIsDark } from "@/hooks/use-is-dark";
import { getChartTheme } from "@/lib/chart-theme";
import type {
  CriterionAveragePoint,
  JudgeProgressPoint,
  ScoreDistributionBucket,
  SubmissionDistributionPoint,
} from "@/types/analytics";

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-72">{children}</CardContent>
    </Card>
  );
}

function tooltipStyle(theme: ReturnType<typeof getChartTheme>) {
  return {
    backgroundColor: theme.surface,
    border: `1px solid ${theme.grid}`,
    borderRadius: 8,
    fontSize: 12,
    color: theme.primaryText,
  };
}

export function SubmissionDistributionChart({ data }: { data: SubmissionDistributionPoint[] }) {
  const theme = getChartTheme(useIsDark());
  return (
    <ChartCard title="Submission distribution by problem statement">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 8 }}>
          <CartesianGrid stroke={theme.grid} vertical={false} />
          <XAxis
            dataKey="problem_statement"
            tick={{ fill: theme.mutedText, fontSize: 11 }}
            axisLine={{ stroke: theme.axis }}
            tickLine={false}
            interval={0}
            angle={-15}
            textAnchor="end"
            height={50}
          />
          <YAxis tick={{ fill: theme.mutedText, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle(theme)} cursor={{ fill: theme.grid, opacity: 0.4 }} />
          <Bar dataKey="count" name="Submissions" fill={theme.categorical[0]} radius={[4, 4, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function JudgeProgressChart({ data }: { data: JudgeProgressPoint[] }) {
  const theme = getChartTheme(useIsDark());
  const pendingColor = theme.grid === "#2c2c2a" ? "#52514e" : "#c3c2b7";
  return (
    <ChartCard title="Judge progress">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 8 }}>
          <CartesianGrid stroke={theme.grid} vertical={false} />
          <XAxis
            dataKey="judge_name"
            tick={{ fill: theme.mutedText, fontSize: 11 }}
            axisLine={{ stroke: theme.axis }}
            tickLine={false}
            interval={0}
            angle={-15}
            textAnchor="end"
            height={50}
          />
          <YAxis tick={{ fill: theme.mutedText, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle(theme)} cursor={{ fill: theme.grid, opacity: 0.4 }} />
          <Legend wrapperStyle={{ fontSize: 12, color: theme.secondaryText }} />
          <Bar dataKey="completed" name="Completed" stackId="a" fill={theme.statusGood} radius={[0, 0, 0, 0]} maxBarSize={40} />
          <Bar dataKey="pending" name="Pending" stackId="a" fill={pendingColor} radius={[4, 4, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function ScoreDistributionChart({ data }: { data: ScoreDistributionBucket[] }) {
  const theme = getChartTheme(useIsDark());
  return (
    <ChartCard title="Score distribution">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 8 }}>
          <CartesianGrid stroke={theme.grid} vertical={false} />
          <XAxis dataKey="range_label" tick={{ fill: theme.mutedText, fontSize: 11 }} axisLine={{ stroke: theme.axis }} tickLine={false} />
          <YAxis tick={{ fill: theme.mutedText, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle(theme)} cursor={{ fill: theme.grid, opacity: 0.4 }} />
          <Bar dataKey="count" name="Submissions" fill={theme.categorical[2]} radius={[4, 4, 0, 0]} maxBarSize={56} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function CriterionAveragesChart({ data }: { data: CriterionAveragePoint[] }) {
  const theme = getChartTheme(useIsDark());
  return (
    <ChartCard title="Average score by criterion">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
          <CartesianGrid stroke={theme.grid} horizontal={false} />
          <XAxis type="number" domain={[0, 10]} tick={{ fill: theme.mutedText, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="criterion_name"
            tick={{ fill: theme.secondaryText, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={110}
          />
          <Tooltip contentStyle={tooltipStyle(theme)} cursor={{ fill: theme.grid, opacity: 0.4 }} />
          <Bar dataKey="average_score" name="Average score" fill={theme.categorical[0]} radius={[0, 4, 4, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
