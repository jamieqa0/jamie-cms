import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function ProtectedRoute() {
  const { session, initializing } = useAuthStore();
  if (initializing) return null;
  return session ? <Outlet /> : <Navigate to="/" replace />;
}
