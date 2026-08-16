import {
  BarChart3,
  ClipboardList,
  Gauge,
  History,
  LayoutDashboard,
  ListChecks,
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
const SubmissionDetailPage = lazy(() =>
  import("@/features/submissions/pages/submission-detail-page").then((m) => ({ default: m.SubmissionDetailPage }))
);
const SubmissionsPage = lazy(() =>
  import("@/features/submissions/pages/submissions-page").then((m) => ({ default: m.SubmissionsPage }))
);
const SubmissionViewPage = lazy(() =>
  import("@/features/submissions/pages/submission-view-page").then((m) => ({ default: m.SubmissionViewPage }))
);
const CoveragePage = lazy(() =>
  import("@/features/analytics/pages/coverage-page").then((m) => ({ default: m.CoveragePage }))
);
const AuditLogPage = lazy(() => import("@/features/audit/pages/audit-log-page").then((m) => ({ default: m.AuditLogPage })));

const adminNav: NavItem[] = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/submissions", label: "Submissions", icon: ClipboardList },
  // Administrators review as well as oversee. This renders the same pages as the judge
  // console, inside the admin shell -- see lib/review-routes.ts.
  { to: "/admin/review", label: "Review submissions", icon: ListChecks },
  { to: "/admin/coverage", label: "Coverage", icon: Gauge },
  { to: "/admin/judges", label: "Judges", icon: Users },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin/leaderboard", label: "Leaderboard", icon: Trophy },
  { to: "/admin/audit-logs", label: "Audit history", icon: History },
];

const judgeNav: NavItem[] = [
  { to: "/judge/dashboard", label: "Your reviews", icon: ListChecks },
  // The same page as the admin leaderboard; it renders a reduced table for judges and the
  // server sends them a reduced payload to match.
  { to: "/judge/leaderboard", label: "Leaderboard", icon: Trophy },
];

// An admin who follows "Review submissions" into the judge shell would otherwise have no way
// back except the browser -- this is the same shell, just with an extra link home for the
// role that has somewhere else to go.
const adminReviewNav: NavItem[] = [
  { to: "/admin/dashboard", label: "Back to admin", icon: LayoutDashboard },
  { to: "/judge/dashboard", label: "Your reviews", icon: ListChecks },
];

function HomeRedirect() {
  const { token, user } = useAuthStore();
  if (!token || !user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "admin" ? "/admin/dashboard" : "/judge/dashboard"} replace />;
}

/**
 * The review pages are shared by both roles (see the required-changes note: reuse
 * JudgeDashboardPage rather than forking it), so the shell around them picks its nav and brand
 * from whoever is actually signed in rather than being fixed at the route level.
 */
function ReviewShell() {
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === "admin";
  return (
    <AppShell
      navItems={isAdmin ? adminReviewNav : judgeNav}
      brand={isAdmin ? "Eval Admin" : "Eval Judge"}
      pageTitle="Review submissions"
    />
  );
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

        <Route element={<ProtectedRoute roles={["admin"]} />}>
          <Route element={<AppShell navItems={adminNav} brand="Eval Admin" pageTitle="Administrator console" />}>
            <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
            <Route path="/admin/submissions" element={<SubmissionsPage />} />
            <Route path="/admin/submissions/:id" element={<SubmissionDetailPage />} />
            {/* Same components as the judge console; the admin shell stays in place. */}
            <Route path="/admin/review" element={<JudgeDashboardPage />} />
            <Route path="/admin/review/:evaluationId" element={<EvaluationPage />} />
            <Route path="/admin/coverage" element={<CoveragePage />} />
            <Route path="/admin/judges" element={<JudgesPage />} />
            <Route path="/admin/analytics" element={<AnalyticsPage />} />
            <Route path="/admin/leaderboard" element={<LeaderboardPage />} />
            <Route path="/admin/audit-logs" element={<AuditLogPage />} />
          </Route>
        </Route>

        {/* Organisers judge too: admins are admitted here alongside judges, matching
            requireReviewer on the API side. Judges still cannot reach the admin-only routes
            above. */}
        <Route element={<ProtectedRoute roles={["judge", "admin"]} />}>
          <Route element={<ReviewShell />}>
            <Route path="/judge/dashboard" element={<JudgeDashboardPage />} />
            <Route path="/judge/evaluate/:evaluationId" element={<EvaluationPage />} />
            <Route path="/judge/leaderboard" element={<LeaderboardPage />} />
            {/* Read-only view reached from a leaderboard row. Not the admin detail page,
                which lists every judge's scores. */}
            <Route path="/judge/submissions/:id" element={<SubmissionViewPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
