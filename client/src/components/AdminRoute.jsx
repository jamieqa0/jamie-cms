import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function AdminRoute() {
  const { user } = useAuthStore();
  // initializing 체크는 ProtectedRoute에서 이미 처리됨
  return user?.role === 'admin' ? <Outlet /> : <Navigate to="/dashboard" replace />;
}
