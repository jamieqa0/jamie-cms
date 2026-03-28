import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function CompanyRoute() {
  const { user } = useAuthStore();
  return user?.role === 'company' ? <Outlet /> : <Navigate to="/dashboard" replace />;
}
