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
    `px-4 py-2 rounded-xl text-sm font-semibold transition ${
      isActive
        ? 'bg-blue-600 text-white shadow-sm'
        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
    }`;

  return (
    <div className="min-h-screen bg-slate-50 overflow-x-hidden">
      <nav className="bg-white border-b border-slate-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <span className="font-extrabold text-slate-900 text-lg tracking-tight">
              Jamie<span className="text-blue-600">Pay</span>
            </span>
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-400 hidden sm:block mr-2">{user?.nickname}</span>
              <NavLink to="/profile" className={({ isActive }) =>
                `px-3 py-1.5 rounded-xl text-sm font-semibold transition ${isActive ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`
              }>프로필</NavLink>
              <button onClick={handleLogout} className="text-sm text-slate-400 hover:text-red-500 px-3 py-1.5 transition">로그아웃</button>
            </div>
          </div>
          <div className="flex items-center gap-1 pb-2 overflow-x-auto">
            <NavLink to="/dashboard" className={navClass}>대시보드</NavLink>
            <NavLink to="/subscriptions" className={navClass}>내 구독</NavLink>
            <NavLink to="/invoices" className={navClass}>내 청구서</NavLink>
            <NavLink to="/products" className={navClass}>상품</NavLink>
            {user?.role === 'admin' && (
              <NavLink to="/admin" className={navClass}>어드민</NavLink>
            )}
          </div>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
