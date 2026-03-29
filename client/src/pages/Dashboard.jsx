import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSubscriptions } from '../api/subscriptions';
import { getUserInvoices } from '../api/invoices';
import { useAuthStore } from '../store/authStore';

export default function Dashboard() {
  const { user } = useAuthStore();
  const [subscriptions, setSubscriptions] = useState([]);
  const [invoices, setInvoices] = useState([]);

  useEffect(() => {
    getSubscriptions().then(r => setSubscriptions(r.data));
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    getUserInvoices(user.id).then(setInvoices).catch(() => {});
  }, [user?.id]);

  const activeCount = subscriptions.filter(s => s.status === 'active').length;
  const recentInvoices = invoices.slice(0, 3);
  const unpaidCount = invoices.filter(i => i.status === 'issued').length;

  const INV_STATUS_COLOR = { issued: 'text-yellow-600', paid: 'text-green-600', failed: 'text-red-600' };
  const INV_STATUS_LABEL = { issued: '미납', paid: '납부완료', failed: '실패' };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">안녕하세요, {user?.nickname}님</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <p className="text-slate-500 text-sm">활성 구독</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{activeCount}개</p>
          <Link to="/subscriptions" className="text-blue-500 text-sm mt-2 inline-block">구독 관리 →</Link>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <p className="text-slate-500 text-sm">미납 청구서</p>
          <p className={`text-3xl font-bold mt-1 ${unpaidCount > 0 ? 'text-red-500' : 'text-slate-900'}`}>{unpaidCount}건</p>
          <Link to="/invoices" className="text-blue-500 text-sm mt-2 inline-block">청구서 전체 보기 →</Link>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-slate-900">최근 청구서</h2>
          <Link to="/invoices" className="text-blue-500 text-xs">전체 보기 →</Link>
        </div>
        {recentInvoices.length === 0 ? (
          <p className="text-slate-400 text-sm">청구서가 없어요.</p>
        ) : (
          <ul className="space-y-2">
            {recentInvoices.map(inv => (
              <li key={inv.id} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                <div>
                  <p className="text-slate-700 font-medium text-sm">{inv.product_name}</p>
                  <p className="text-slate-400 text-xs">{inv.company_name} · {new Date(inv.issued_at).toLocaleDateString('ko-KR')}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-900 font-medium text-sm">{Number(inv.amount).toLocaleString()}원</p>
                  <p className={`text-xs ${INV_STATUS_COLOR[inv.status]}`}>{INV_STATUS_LABEL[inv.status]}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-slate-900">구독 중인 상품</h2>
          <Link to="/subscriptions" className="text-blue-500 text-xs">전체 보기 →</Link>
        </div>
        {activeCount === 0 ? (
          <p className="text-slate-400 text-sm">구독 중인 상품이 없어요. <Link to="/products" className="text-blue-500">상품 둘러보기 →</Link></p>
        ) : (
          <ul className="space-y-2">
            {subscriptions.filter(s => s.status === 'active').map(s => (
              <li key={s.id} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                <div>
                  <p className="text-slate-700 font-medium">{s.product_name}</p>
                  {s.company_name && <p className="text-slate-400 text-xs mt-0.5">{s.company_name}</p>}
                </div>
                <span className="text-slate-900 font-medium text-sm">{Number(s.amount).toLocaleString()}원 / 매월 {s.billing_day}일</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
