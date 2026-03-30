import { Outlet } from 'react-router-dom';
import AppNav from './AppNav';
import Footer from './Footer';

const NAV_LINKS = [
  { to: '/admin', label: '대시보드', end: true },
  { to: '/admin/users', label: '일반 회원' },
  { to: '/admin/companies', label: '업체 관리' },
  { to: '/admin/transfers', label: '자동이체 내역' },
  { to: '/admin/collection', label: '집금/정산 현황' },
];

const EXTRA_LINKS = [
  { to: '/dashboard', label: '사용자 화면' },
  { to: '/company', label: '업체 화면' },
];

export default function AdminLayout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <AppNav variant="admin" navLinks={NAV_LINKS} extraLinks={EXTRA_LINKS} />
      <main className="max-w-5xl mx-auto px-4 py-6 sm:px-6 sm:py-8 min-h-[calc(100vh-250px)]">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
