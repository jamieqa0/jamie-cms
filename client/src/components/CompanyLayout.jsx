import { Outlet } from 'react-router-dom';
import AppNav from './AppNav';
import Footer from './Footer';

const NAV_LINKS = [
  { to: '/company', label: '대시보드', end: true },
  { to: '/company/products', label: '상품 관리' },
  { to: '/company/customers', label: '고객 관리' },
  { to: '/company/transfers', label: '수납 내역' },
  { to: '/company/unpaid', label: '미수납 관리' },
  { to: '/company/tax-invoices', label: '수수료 세금계산서' },
];

export default function CompanyLayout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <AppNav variant="company" navLinks={NAV_LINKS} profileTo="/company/profile" />
      <main className="max-w-5xl mx-auto px-4 py-6 sm:px-6 sm:py-8 min-h-[calc(100vh-250px)]">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
