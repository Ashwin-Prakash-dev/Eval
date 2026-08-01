import {
  BarChart3,
  ClipboardList,
  History,
  LayoutDashboard,
  ListChecks,
  Navigation,
  SlidersHorizontal,
  Trophy,
  Users,
} from "lucide-react";
import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/store/auth-store";

import type { NavItem } from "./layout/sidebar";
import { AppShell } from "./layout/app-shell";
import { NotFoundPage } from "./not-found-page";
import { ProtectedRoute } from "./protected-route";

const LoginPage = lazy(() => import("@/features/auth/pages/login-page").then((m) => ({ default: m.LoginPage })));
const AdminDashboardPage = lazy(() =>
  import("@/features/analytics/pages/admin-dashboard-page").then((m) => ({ default: m.AdminDashboardPage }))
);
const AnalyticsPage = lazy(() => import("@/features/analytics/pages/analytics-page").then((m) => ({ default: m.AnalyticsPage })));
const AssignmentsPage = lazy(() =>
  import("@/features/assignments/pages/assignments-page").then((m) => ({ default: m.AssignmentsPage }))
);
const EvaluationPage = lazy(() =>
  import("@/features/evaluation/pages/evaluation-page").then((m) => ({ default: m.EvaluationPage }))
);
const JudgeDashboardPage = lazy(() =>
  import("@/features/evaluation/pages/judge-dashboard-page").then((m) => ({ default: m.JudgeDashboardPage }))
);
const JudgesPage = lazy(() => import("@/features/judges/pages/judges-page").then((m) => ({ default: m.JudgesPage })));
const LeaderboardPage = lazy(() =>
  import("@/features/leaderboard/pages/leaderboard-page").then((m) => ({ default: m.LeaderboardPage }))
);
const RubricPage = lazy(() => import("@/features/rubric/pages/rubric-page").then((m) => ({ default: m.RubricPage })));
const SubmissionDetailPage = lazy(() =>
  import("@/features/submissions/pages/submission-detail-page").then((m) => ({ default: m.SubmissionDetailPage }))
);
const SubmissionsPage = lazy(() =>
  import("@/features/submissions/pages/submissions-page").then((m) => ({ default: m.SubmissionsPage }))
);
const AuditLogPage = lazy(() => import("@/features/audit/pages/audit-log-page").then((m) => ({ default: m.AuditLogPage })));

const adminNav: NavItem[] = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/submissions", label: "Submissions", icon: ClipboardList },
  { to: "/admin/judges", label: "Judges", icon: Users },
  { to: "/admin/rubric", label: "Rubric", icon: SlidersHorizontal },
  { to: "/admin/assignments", label: "Assignments", icon: Navigation },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin/leaderboard", label: "Leaderboard", icon: Trophy },
  { to: "/admin/audit-logs", label: "Audit history", icon: History },
];

const judgeNav: NavItem[] = [{ to: "/judge/dashboard", label: "Your reviews", icon: ListChecks }];

function HomeRedirect() {
  const { token, user } = useAuthStore();
  if (!token || !user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "admin" ? "/admin/dashboard" : "/judge/dashboard"} replace />;
}

function RouteFallback() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute role="admin" />}>
          <Route element={<AppShell navItems={adminNav} brand="Eval Admin" pageTitle="Administrator console" />}>
            <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
            <Route path="/admin/submissions" element={<SubmissionsPage />} />
            <Route path="/admin/submissions/:id" element={<SubmissionDetailPage />} />
            <Route path="/admin/judges" element={<JudgesPage />} />
            <Route path="/admin/rubric" element={<RubricPage />} />
            <Route path="/admin/assignments" element={<AssignmentsPage />} />
            <Route path="/admin/analytics" element={<AnalyticsPage />} />
            <Route path="/admin/leaderboard" element={<LeaderboardPage />} />
            <Route path="/admin/audit-logs" element={<AuditLogPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute role="judge" />}>
          <Route element={<AppShell navItems={judgeNav} brand="Eval Judge" pageTitle="Judge console" />}>
            <Route path="/judge/dashboard" element={<JudgeDashboardPage />} />
            <Route path="/judge/evaluate/:evaluationId" element={<EvaluationPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
