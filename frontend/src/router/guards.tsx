import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import type { UserRole } from '../types';

// ---- ProtectedRoute: must be logged in ----
export function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }
  return <Outlet />;
}

// ---- RoleRoute: must be logged in AND have the right role ----
interface RoleRouteProps {
  allowedRoles: UserRole[];
}

export function RoleRoute({ allowedRoles }: RoleRouteProps) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  if (!user || !allowedRoles.includes(user.role)) {
    // Wrong role — redirect to their appropriate home
    if (user?.role === 'MANAGER') return <Navigate to="/dashboard" replace />;
    if (user?.role === 'ADMIN') return <Navigate to="/admin" replace />;
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

// ---- PublicOnlyRoute: logged-in users are redirected away (e.g., auth pages) ----
export function PublicOnlyRoute() {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) return <Outlet />;

  // Redirect to role-based home
  if (user?.role === 'MANAGER') return <Navigate to="/dashboard" replace />;
  if (user?.role === 'ADMIN') return <Navigate to="/admin" replace />;
  return <Navigate to="/" replace />;
}
