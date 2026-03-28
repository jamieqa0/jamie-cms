import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function AdminLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navClass = ({ isActive }) =>
    `px-3 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
      isActive ? 'bg-violet-700 text-white' : 'text-violet-100 hover:bg-violet-700/60'
    }`;

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-violet-900 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-white">Jamie CMS</span>
            <span className="text-xs bg-violet-600 text-white px-2 py-0.5 rounded-full">어드민</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-violet-300 hidden sm:block">{user?.nickname}</span>
            <NavLink
              to="/dashboard"
              className="text-sm text-violet-300 hover:text-white px-2 py-2 transition"
            >
              사용자 화면
            </NavLink>
            <button
              onClick={handleLogout}
              className="text-sm text-red-300 hover:text-red-100 px-2 py-2 transition"
            >
              로그아웃
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1 mt-2 overflow-x-auto pb-1">
          <NavLink to="/admin" end className={navClass}>대시보드</NavLink>
          <NavLink to="/admin/products" className={navClass}>상품 관리</NavLink>
          <NavLink to="/admin/users" className={navClass}>회원 목록</NavLink>
          <NavLink to="/admin/transfers" className={navClass}>자동이체 내역</NavLink>
          <NavLink to="/admin/unpaid" className={navClass}>미수납 관리</NavLink>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
