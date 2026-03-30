import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function CompanyLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navClass = ({ isActive }) =>
    `px-3 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
      isActive ? 'bg-emerald-700 text-white' : 'text-emerald-100 hover:bg-emerald-700/60'
    }`;

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-emerald-900 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-white">제이미 정기납부 메이트</span>
            <span className="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded-full">업체</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-emerald-300 hidden sm:block">{user?.nickname}</span>
            <NavLink
              to="/company/profile"
              className={({ isActive }) =>
                `text-sm px-3 py-1.5 rounded-lg font-medium transition ${isActive ? 'bg-emerald-700 text-white' : 'text-emerald-100 hover:bg-emerald-700/60'}`
              }
            >
              프로필
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
          <NavLink to="/company" end className={navClass}>대시보드</NavLink>
          <NavLink to="/company/products" className={navClass}>상품 관리</NavLink>
          <NavLink to="/company/customers" className={navClass}>고객 관리</NavLink>
          <NavLink to="/company/transfers" className={navClass}>수납 내역</NavLink>
          <NavLink to="/company/unpaid" className={navClass}>미수납 관리</NavLink>
          <NavLink to="/company/tax-invoices" className={navClass}>수수료 세금계산서</NavLink>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
