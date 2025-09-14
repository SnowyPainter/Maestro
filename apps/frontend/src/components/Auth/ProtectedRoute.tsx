
import { Navigate, Outlet } from 'react-router-dom';
import { useSessionStore } from '@/store/session';

export function ProtectedRoute() {
  const token = useSessionStore((state) => state.token);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
