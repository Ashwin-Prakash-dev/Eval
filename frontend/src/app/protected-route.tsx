import { Navigate, Outlet } from "react-router-dom";

import { useAuthStore } from "@/store/auth-store";
import type { UserRole } from "@/types/common";

/**
 * `roles` is a list rather than a single role because the review pages admit both judges and
 * admins now that organisers judge too -- see App.tsx, where the review route is guarded with
 * roles={["judge", "admin"]} while the admin-only console stays roles={["admin"]}.
 */
export function ProtectedRoute({ roles }: { roles: UserRole[] }) {
  const { token, user } = useAuthStore();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }
  if (!roles.includes(user.role)) {
    return <Navigate to={user.role === "admin" ? "/admin/dashboard" : "/judge/dashboard"} replace />;
  }
  return <Outlet />;
}
