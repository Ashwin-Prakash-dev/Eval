import { Navigate, Outlet } from "react-router-dom";

import { useAuthStore } from "@/store/auth-store";
import type { UserRole } from "@/types/common";

export function ProtectedRoute({ role }: { role: UserRole }) {
  const { token, user } = useAuthStore();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }
  if (user.role !== role) {
    return <Navigate to={user.role === "admin" ? "/admin/dashboard" : "/judge/dashboard"} replace />;
  }
  return <Outlet />;
}
