import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAccounts } from '../api/accounts';
import { getSubscriptions } from '../api/subscriptions';
import { useAuthStore } from '../store/authStore';

export default function Dashboard() {
  const { user } = useAuthStore();
  const [accounts, setAccounts] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);

  useEffect(() => {
    getAccounts().then(r => setAccounts(r.data));
    getSubscriptions().then(r => setSubscriptions(r.data));
  }, []);

  const totalBalance = accounts.reduce((sum, a) => sum + Number(a.balance), 0);
  const activeCount = subscriptions.filter(s => s.status === 'active').length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">안녕하세요, {user?.nickname}님 👋</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <p className="text-slate-500 text-sm">총 잔액</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{totalBalance.toLocaleString()}원</p>
          <Link to="/accounts" className="text-blue-500 text-sm mt-2 inline-block">계좌 관리 →</Link>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <p className="text-slate-500 text-sm">활성 구독</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{activeCount}개</p>
          <Link to="/subscriptions" className="text-blue-500 text-sm mt-2 inline-block">구독 관리 →</Link>
        </div>
      </div>
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <h2 className="font-semibold text-slate-900 mb-4">구독 중인 상품</h2>
        {activeCount === 0 ? (
          <p className="text-slate-400 text-sm">구독 중인 상품이 없어요. <Link to="/products" className="text-blue-500">상품 둘러보기 →</Link></p>
        ) : (
          <ul className="space-y-2">
            {subscriptions.filter(s => s.status === 'active').map(s => (
              <li key={s.id} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                <span className="text-slate-700">{s.product_name}</span>
                <span className="text-slate-900 font-medium">{Number(s.amount).toLocaleString()}원 / 매월 {s.billing_day}일</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
