import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { logout as logoutApi } from '../api/auth';

export default function Layout() {
  const { user, refreshToken, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try { await logoutApi(refreshToken); } catch {}
    logout();
    navigate('/');
  };

  const navClass = ({ isActive }) =>
    `px-3 py-2 rounded-lg text-sm font-medium transition ${
      isActive ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
    }`;

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="font-bold text-slate-900 mr-4">Jamie CMS</span>
          <NavLink to="/dashboard" className={navClass}>대시보드</NavLink>
          <NavLink to="/products" className={navClass}>상품</NavLink>
          <NavLink to="/subscriptions" className={navClass}>구독</NavLink>
          <NavLink to="/accounts" className={navClass}>계좌</NavLink>
          {user?.role === 'admin' && (
            <NavLink to="/admin" className={navClass}>어드민</NavLink>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">{user?.nickname}</span>
          <NavLink to="/profile" className={navClass}>프로필</NavLink>
          <button onClick={handleLogout} className="text-sm text-red-500 hover:text-red-700">로그아웃</button>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
