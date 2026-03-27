import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAdminUsers, getAdminTransfers, getAdminProducts } from '../../api/admin';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ users: 0, products: 0, transfers: 0 });

  useEffect(() => {
    Promise.all([getAdminUsers(), getAdminProducts(), getAdminTransfers()]).then(
      ([u, p, t]) => setStats({ users: u.data.length, products: p.data.length, transfers: t.data.length })
    );
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">어드민 대시보드</h1>
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: '전체 회원', value: stats.users, to: '/admin/users' },
          { label: '등록 상품', value: stats.products, to: '/admin/products' },
          { label: '자동이체 실행 기록', value: stats.transfers, to: '/admin/transfers' },
        ].map(item => (
          <Link key={item.label} to={item.to}
            className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:border-slate-300 transition">
            <p className="text-slate-500 text-sm">{item.label}</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{item.value}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
