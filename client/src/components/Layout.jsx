import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navClass = ({ isActive }) =>
    `px-3 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
      isActive ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
    }`;

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-900">Jamie CMS</span>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 hidden sm:block">{user?.nickname}</span>
            <NavLink to="/profile" className={navClass}>프로필</NavLink>
            <button onClick={handleLogout} className="text-sm text-red-500 hover:text-red-700 px-2 py-2">로그아웃</button>
          </div>
        </div>
        <div className="flex items-center gap-1 mt-2 overflow-x-auto pb-1">
          <NavLink to="/dashboard" className={navClass}>대시보드</NavLink>
          <NavLink to="/subscriptions" className={navClass}>내 구독</NavLink>
          <NavLink to="/invoices" className={navClass}>내 청구서</NavLink>
          <NavLink to="/products" className={navClass}>상품</NavLink>
          {user?.role === 'admin' && (
            <NavLink to="/admin" className={navClass}>어드민</NavLink>
          )}
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
