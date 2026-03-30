import { Outlet } from 'react-router-dom';
import AppNav from './AppNav';
import Footer from './Footer';

const NAV_LINKS = [
  { to: '/dashboard', label: '대시보드' },
  { to: '/subscriptions', label: '내 구독' },
  { to: '/invoices', label: '내 청구서' },
  { to: '/products', label: '상품' },
];

export default function Layout() {
  return (
    <div className="min-h-screen bg-slate-50 overflow-x-hidden">
      <AppNav variant="user" navLinks={NAV_LINKS} profileTo="/profile" />
      <main className="max-w-5xl mx-auto px-4 py-6 sm:px-6 sm:py-8 min-h-[calc(100vh-250px)]">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
